const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const sgMail = require("@sendgrid/mail");

// No test may reach a database: fail fast instead of buffering queries.
mongoose.set("bufferCommands", false);
process.env.JWT_SECRET = "test-secret";

const { runApp, closeApp } = require("../src/app");
const initModules = require("../src/initModules");
const ApiFeatures = require("../src/utils/apiFeatures");
const Product = require("../src/modules/product/models/productModel");
const Order = require("../src/modules/order/models/orderModel");
const User = require("../src/modules/user/models/userModel");
const products = require("../src/modules/product/controllers");
const orders = require("../src/modules/order/controllers");
const users = require("../src/modules/user/controllers");

let server;
let baseUrl;

before(async () => {
  const app = runApp();
  initModules(app);
  closeApp(app);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(() => server.close());

const request = (path, { body, headers = {}, method = body ? "POST" : "GET" } = {}) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body && JSON.stringify(body),
  });

// Runs a controller with a fake req and resolves with the response body or the error passed to next().
const call = (handler, req) =>
  new Promise((resolve) => {
    const res = {
      status() {
        return this;
      },
      json: (body) => resolve({ body }),
    };
    handler(req, res, (err) => resolve({ err }));
  });

const id = () => new mongoose.Types.ObjectId();

test("login and forgot-password reject operator objects in the body", async () => {
  const login = await request("/login", {
    body: { email: { $gt: "" }, password: "x" },
  });
  assert.equal(login.status, 401);

  const forgot = await request("/password/forgot", {
    body: { email: { $ne: null } },
  });
  assert.equal(forgot.status, 400);
});

test("review routes reject ids that are not ObjectId strings", async () => {
  assert.equal((await request("/reviews?id[$ne]=x")).status, 400);
  const reviewId = id();
  assert.equal((await request(`/reviews?id=${reviewId}&id=${reviewId}`)).status, 400);
});

test("an invalid JWT is a 400, not a 500", async () => {
  const res = await request("/user/me", {
    headers: { authorization: "Bearer not-a-jwt" },
  });
  assert.equal(res.status, 400);
});

test("sanitizeFilter turns request operators into errors", async () => {
  await assert.rejects(
    User.findOne({ email: { $gt: "" } }).exec(),
    mongoose.Error.CastError
  );
  await assert.rejects(
    Product.find({ $where: "sleep(1000)" }).exec(),
    /not allowed with sanitizeFilter/
  );
});

test("product filters keep only category and price/ratings ranges", () => {
  const query = new ApiFeatures(Product.find(), {
    keyword: "a.*",
    $where: "sleep(1000)",
    category: "Laptop",
    "category[$ne]": "x",
    "stock[$gt]": "0",
    "price[gte]": "10",
    "price[lte]": "99",
    "ratings[gte]": "4",
  })
    .search()
    .filter().query;

  assert.deepEqual(JSON.parse(JSON.stringify(query.getFilter())), {
    name: { $regex: "a\\.\\*", $options: "i" },
    category: "Laptop",
    price: { $gte: "10", $lte: "99" },
    ratings: { $gte: "4" },
  });
});

test("createProduct bounds the image list before any upload", async () => {
  const user = { id: `${id()}` };

  for (const images of [{ length: 1e9 }, Array(11).fill("img"), [{}]]) {
    const { err } = await call(products.createProduct, { body: { images }, user });
    assert.equal(err.statusCode, 400);
  }
});

test("only the author or an admin can delete a review", async (t) => {
  const author = id();
  const review = { _id: id(), user: author, rating: 5 };
  t.mock.method(Product, "findById", async () => ({ reviews: [review] }));
  t.mock.method(Product, "findByIdAndUpdate", async () => ({}));
  const query = { productId: `${id()}`, id: `${review._id}` };

  const other = await call(products.deleteReview, {
    query,
    user: { _id: id(), role: "user" },
  });
  assert.equal(other.err.statusCode, 403);

  const own = await call(products.deleteReview, {
    query,
    user: { _id: author, role: "user" },
  });
  assert.equal(own.body.success, true);
});

test("an order is visible only to its owner and admins", async (t) => {
  const owner = id();
  t.mock.method(Order, "findById", () => ({
    populate: async () => ({ user: { _id: owner } }),
  }));
  const params = { id: `${id()}` };

  const other = await call(orders.getCustomOrder, {
    params,
    user: { _id: id(), role: "user" },
  });
  assert.equal(other.err.statusCode, 404);

  for (const user of [{ _id: owner, role: "user" }, { _id: id(), role: "admin" }]) {
    assert.equal((await call(orders.getCustomOrder, { params, user })).body.success, true);
  }
});

test("a deleted user's token is rejected", async (t) => {
  const { isAuthenticatedUser } = require("../src/middlewares/auth");
  t.mock.method(User, "findById", async () => null);
  const token = jwt.sign({ id: `${id()}` }, process.env.JWT_SECRET);

  const { err } = await call(isAuthenticatedUser, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(err.statusCode, 401);
});

test("the reset link uses FRONTEND_URL, never the Host header", async (t) => {
  process.env.FRONTEND_URL = "https://shop.example";
  const sent = [];
  t.mock.method(sgMail, "send", async (msg) => sent.push(msg));
  t.mock.method(User, "findOne", async () => ({
    name: "Test User",
    email: "user@example.com",
    generatePasswordResetToken: () => "reset-token",
    save: async () => {},
  }));

  await call(users.forgotPassword, {
    body: { email: "user@example.com" },
    protocol: "https",
    get: () => "attacker.example",
  });

  assert.match(sent[0].text, /https:\/\/shop\.example\/auth\/password\/reset\/reset-token/);
  assert.doesNotMatch(sent[0].text, /attacker\.example/);
});

test("passwords hash once and never serialize", async () => {
  const user = new User({
    name: "Test User",
    email: "user@example.com",
    password: "password123",
  });
  await assert.rejects(user.save(), /initial connection/);
  assert.equal(await bcrypt.compare("password123", user.password), true);
  assert.equal("password" in user.toJSON(), false);

  const stored = User.hydrate({ _id: id(), ...user.toObject() });
  stored.name = "Other Name";
  await assert.rejects(stored.save(), /initial connection/);
  assert.equal(stored.password, user.password);
});

test("auth routes allow 10 attempts per 15 minutes per client IP", async () => {
  const headers = { "x-forwarded-for": "203.0.113.7" };

  for (let i = 0; i < 10; i++) {
    assert.equal((await request("/login", { body: {}, headers })).status, 401);
  }
  assert.equal((await request("/login", { body: {}, headers })).status, 429);
});
