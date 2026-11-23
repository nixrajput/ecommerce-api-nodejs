const mongoose = require("mongoose");
const Product = require("../product/models/productModel");
const ErrorHandler = require("../../utils/errorHandler");

const MAX_ITEMS = 50;

// Prices come from the database, never from the request. The rules match the checkout summary
// in ecommerce-web-reactjs (src/components/modules/checkout/order-summary/index.js).
// That summary leaves shipping out of the total, so this does too.
exports.priceOrder = async (orderItems) => {
  if (
    !Array.isArray(orderItems) ||
    orderItems.length === 0 ||
    orderItems.length > MAX_ITEMS
  ) {
    throw new ErrorHandler(`Send 1 to ${MAX_ITEMS} order items.`, 400);
  }

  for (const item of orderItems) {
    if (
      !mongoose.isObjectIdOrHexString(item?.product) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      throw new ErrorHandler(
        "Each order item needs a product id and a whole quantity.",
        400
      );
    }
  }

  const products = await Product.find({
    _id: mongoose.trusted({ $in: orderItems.map((item) => item.product) }),
  });
  const byId = new Map(products.map((product) => [String(product._id), product]));

  const items = orderItems.map((item) => {
    const product = byId.get(String(item.product));

    if (!product) {
      throw new ErrorHandler("Product not found.", 404);
    }

    return {
      product: product._id,
      name: product.name,
      price: product.price,
      image: product.images[0]?.url ?? item.image,
      quantity: item.quantity,
    };
  });

  const itemsPrice = items.reduce(
    (acc, item) => acc + item.quantity * item.price,
    0
  );
  const shippingPrice = itemsPrice > 1000 ? 0 : 50;
  const taxPrice = itemsPrice * 0.18;
  const totalPrice = itemsPrice + taxPrice;

  return {
    items,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
    // Stripe takes INR in paise, rounded the way the frontend rounded it.
    amount: Math.round(totalPrice * 100),
    currency: "inr",
  };
};
