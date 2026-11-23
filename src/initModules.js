const userModule = require("./modules/user");
const productModule = require("./modules/product");
const orderModule = require("./modules/order");
const paymentModule = require("./modules/payment");
const mongoose = require("mongoose");

// Request values that carry $-operators get wrapped in $eq (or rejected at the top level).
// Every query that means to use an operator must wrap it in mongoose.trusted().
mongoose.set("sanitizeFilter", true);

module.exports = (app) => {
  userModule.init(app);
  productModule.init(app);
  orderModule.init(app);
  paymentModule.init(app);
};
