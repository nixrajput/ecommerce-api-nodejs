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
process.env.JWT_EXPIRES_IN = "1d";

const { runApp, closeApp } = require("../src/app");
const initModules = require("../src/initModules");
const ApiFeatures = require("../src/utils/apiFeatures");
const Product = require("../src/modules/product/models/productModel");
const Order = require("../src/modules/order/models/orderModel");
const User = require("../src/modules/user/models/userModel");
const products = require("../src/modules/product/controllers");
const orders = require("../src/modules/order/controllers");
const payments = require("../src/modules/payment/controllers");
const users = require("../src/modules/user/controllers");
const { priceOrder } = require("../src/modules/order/pricing");
const stripe = require("../src/utils/stripe");
const errorMiddleware = require("../src/middlewares/error");
const ErrorHandler = require("../src/utils/errorHandler");

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

// Runs a handler with a fake req. Resolves with the response or with the error passed to next().
const call = (handler, req) =>
  new Promise((resolve) => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json: (body) => resolve({ status: res.statusCode, body }),
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

const laptop = { _id: id(), name: "Laptop", price: 2000, images: [{ url: "laptop.png" }] };
const cable = { _id: id(), name: "Cable", price: 300, images: [{ url: "cable.png" }] };
// The shape the frontend sends today: its cart items, with prices the server must ignore.
const cartItem = (product, quantity) => ({
  product: `${product._id}`,
  name: product.name,
  price: 1,
  image: "tampered.png",
  stock: 5,
  quantity,
});

test("order totals follow the frontend checkout rules", async (t) => {
  t.mock.method(Product, "find", async () => [laptop, cable]);

  const big = await priceOrder([cartItem(laptop, 2)]);
  assert.deepEqual(
    [big.itemsPrice, big.taxPrice, big.shippingPrice, big.totalPrice, big.amount],
    [4000, 720, 0, 4720, 472000]
  );

  const small = await priceOrder([cartItem(cable, 1)]);
  assert.deepEqual(
    [small.itemsPrice, small.taxPrice, small.shippingPrice, small.totalPrice],
    [300, 54, 50, 354]
  );

  await assert.rejects(priceOrder([{ product: `${laptop._id}`, quantity: 0 }]), {
    statusCode: 400,
  });
  await assert.rejects(priceOrder([]), { statusCode: 400 });
});

test("createPayment charges the server total, not the body amount", async (t) => {
  t.mock.method(Product, "find", async () => [laptop]);
  const create = t.mock.fn(async () => ({ client_secret: "secret" }));
  t.mock.method(stripe, "client", () => ({ paymentIntents: { create } }));
  const user = { _id: id() };

  await call(payments.createPayment, {
    body: { amount: 100, email: "user@example.com", orderItems: [cartItem(laptop, 2)] },
    user,
  });
  const params = create.mock.calls[0].arguments[0];
  assert.equal(params.amount, 472000);
  assert.equal(params.currency, "inr");
  assert.equal(params.metadata.user, `${user._id}`);

  const { err } = await call(payments.createPayment, { body: { amount: 100 }, user });
  assert.equal(err.statusCode, 400);
});

test("createNewOrder ignores client prices and forged payment status", async (t) => {
  const user = { _id: id(), role: "user" };
  let intent;
  t.mock.method(Product, "find", async () => [laptop]);
  t.mock.method(Order, "exists", async () => null);
  const created = t.mock.method(Order, "create", async (doc) => doc);
  t.mock.method(stripe, "client", () => ({
    paymentIntents: { retrieve: async () => intent },
  }));
  const paid = {
    id: "pi_paid",
    status: "succeeded",
    amount: 472000,
    currency: "inr",
    metadata: { user: `${user._id}` },
  };
  const body = {
    shippingInfo: { address: "1 Road", city: "Delhi", state: "DL", country: "IN", pinCode: 110001, phoneNo: 9999999999 },
    orderItems: [cartItem(laptop, 2)],
    itemsPrice: 2,
    taxPrice: 0,
    shippingPrice: 0,
    totalPrice: 2,
    paymentInfo: { id: "pi_paid", status: "succeeded" },
  };

  intent = paid;
  const { body: ok } = await call(orders.createNewOrder, { body, user });
  assert.deepEqual(
    [ok.result.itemsPrice, ok.result.taxPrice, ok.result.totalPrice, ok.result.orderItems[0].price],
    [4000, 720, 4720, 2000]
  );

  for (const forged of [
    { status: "requires_payment_method" },
    { amount: 200 },
    { currency: "usd" },
    { metadata: { user: `${id()}` } },
  ]) {
    intent = { ...paid, ...forged };
    const { err } = await call(orders.createNewOrder, { body, user });
    assert.equal(err.statusCode, 400);
  }
  assert.equal(created.mock.callCount(), 1);
});

test("a PaymentIntent cannot pay for a second order", async (t) => {
  t.mock.method(Product, "find", async () => [laptop]);
  const retrieve = t.mock.fn(async () => ({}));
  t.mock.method(stripe, "client", () => ({ paymentIntents: { retrieve } }));
  const exists = t.mock.method(Order, "exists", async () => ({ _id: id() }));
  const req = {
    body: { orderItems: [cartItem(laptop, 2)], paymentInfo: { id: "pi_used" } },
    user: { _id: id() },
  };

  assert.equal((await call(orders.createNewOrder, req)).err.statusCode, 400);
  assert.equal(retrieve.mock.callCount(), 0);

  // Two concurrent requests both pass exists(); the unique index rejects the second insert.
  exists.mock.mockImplementation(async () => null);
  retrieve.mock.mockImplementation(async () => ({
    id: "pi_used",
    status: "succeeded",
    amount: 472000,
    currency: "inr",
    metadata: { user: `${req.user._id}` },
  }));
  t.mock.method(Order, "create", async () => {
    throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
  });
  const { err } = await call(orders.createNewOrder, req);
  assert.equal(err.message, "This payment is already linked to an order.");
});

test("tokens are not stored, and stored legacy tokens never serialize", () => {
  const user = new User({ name: "Test User", email: "user@example.com", password: "password123" });
  user.generateToken();
  assert.equal(user.toObject().token, undefined);

  const legacy = User.hydrate({ _id: id(), name: "Old User", token: "old.jwt", expiresAt: "1" });
  assert.equal("token" in legacy.toJSON(), false);
  assert.equal("expiresAt" in legacy.toJSON(), false);
});

test("tokens issued before a password change are rejected", async (t) => {
  const { isAuthenticatedUser } = require("../src/middlewares/auth");
  t.mock.method(User, "findById", async () => ({ passwordChangedAt: new Date() }));
  const sign = (iat) => jwt.sign({ id: `${id()}`, iat }, process.env.JWT_SECRET);
  const auth = (token) => call(isAuthenticatedUser, { headers: { authorization: `Bearer ${token}` } });
  const now = Math.floor(Date.now() / 1000);

  assert.equal((await auth(sign(now - 60))).err.statusCode, 401);
  assert.equal((await auth(sign(now))).err, undefined);
});

test("saving a new password records passwordChangedAt", async () => {
  const user = User.hydrate({
    _id: id(),
    name: "Test User",
    email: "user@example.com",
    password: "old-hash",
  });
  user.password = "new-password";
  await assert.rejects(user.save(), /initial connection/);
  assert.ok(user.passwordChangedAt instanceof Date);
});

test("forgot-password answers the same whether or not the account exists", async (t) => {
  const findOne = t.mock.method(User, "findOne", async () => null);
  t.mock.method(sgMail, "send", async () => {});
  const req = { body: { email: "nobody@example.com" } };

  const unknown = await call(users.forgotPassword, req);

  findOne.mock.mockImplementation(async () => ({
    name: "Test User",
    email: "user@example.com",
    generatePasswordResetToken: () => "reset-token",
    save: async () => {},
  }));
  const known = await call(users.forgotPassword, req);

  assert.equal(unknown.status, 200);
  assert.deepEqual(unknown, known);
});

test("production 5xx responses hide details, 4xx keep them", (t) => {
  const logged = t.mock.method(console, "error", () => {});
  const nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const send = (err) => {
    const out = {};
    errorMiddleware(err, {}, {
      status(code) {
        out.status = code;
        return this;
      },
      json(body) {
        out.message = body.message;
      },
    });
    return out;
  };

  try {
    assert.deepEqual(send(new Error("mongodb://user:pass@host failed")), {
      status: 500,
      message: "Internal Server Error",
    });
    assert.equal(logged.mock.callCount(), 1);

    const stripeAuth = Object.assign(new Error("Invalid API Key provided: sk_test_***"), {
      type: "StripeAuthenticationError",
      statusCode: 401,
    });
    assert.deepEqual(send(stripeAuth), { status: 502, message: "Internal Server Error" });

    assert.deepEqual(send(new ErrorHandler("Product not found.", 404)), {
      status: 404,
      message: "Product not found.",
    });
    const invalid = new User({ name: "ab" }).validateSync();
    assert.equal(send(invalid).status, 400);
  } finally {
    process.env.NODE_ENV = nodeEnv;
  }
});
