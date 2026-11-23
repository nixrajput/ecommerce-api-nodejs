const Order = require("../models/orderModel");
const Product = require("../../product/models/productModel");
const ErrorHandler = require("../../../utils/errorHandler");
const catchAsyncError = require("../../../middlewares/catchAsyncError");
const stripe = require("../../../utils/stripe");
const { priceOrder } = require("../pricing");

const PAYMENT_USED = "This payment is already linked to an order.";

// Create New Order
exports.createNewOrder = catchAsyncError(async (req, res, next) => {
  // Client-sent prices and paymentInfo.status are ignored on purpose.
  const { shippingInfo, orderItems, paymentInfo } = req.body;
  const priced = await priceOrder(orderItems);
  const paymentId = paymentInfo?.id;

  if (typeof paymentId !== "string" || !paymentId) {
    return next(new ErrorHandler("Payment id is required.", 400));
  }

  if (await Order.exists({ "paymentInfo.id": paymentId })) {
    return next(new ErrorHandler(PAYMENT_USED, 400));
  }

  const intent = await stripe.client().paymentIntents.retrieve(paymentId);

  if (
    intent.status !== "succeeded" ||
    intent.amount !== priced.amount ||
    intent.currency !== priced.currency ||
    intent.metadata?.user !== String(req.user._id)
  ) {
    return next(
      new ErrorHandler("Payment does not match this order or is not complete.", 400)
    );
  }

  let order;
  try {
    order = await Order.create({
      shippingInfo,
      orderItems: priced.items,
      paymentInfo: { id: intent.id, status: intent.status },
      itemsPrice: priced.itemsPrice,
      taxPrice: priced.taxPrice,
      shippingPrice: priced.shippingPrice,
      totalPrice: priced.totalPrice,
      paidAt: Date.now(),
      user: req.user._id,
    });
  } catch (err) {
    // The unique index on paymentInfo.id catches two concurrent orders for one payment.
    if (err.code === 11000) {
      return next(new ErrorHandler(PAYMENT_USED, 400));
    }
    throw err;
  }

  res.status(200).json({
    success: true,
    message: "Order created successfully.",
    result: order,
  });
});

// Get Custom Order
exports.getCustomOrder = catchAsyncError(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "user",
    "name email"
  );

  // 404, not 403, so other users cannot probe which order ids exist.
  if (
    !order ||
    (order.user?._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin")
  ) {
    return next(new ErrorHandler("Order not found.", 404));
  }

  res.status(200).json({
    success: true,
    result: order,
  });
});

// Get Logged In User Order
exports.getMyOrders = catchAsyncError(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id });

  res.status(200).json({
    success: true,
    results: orders,
  });
});

// Get All Orders -- Admin
exports.getAllOrders = catchAsyncError(async (req, res, next) => {
  const orders = await Order.find();
  const orderCount = await Order.countDocuments();

  let totalAmount = 0.0;

  orders.forEach((doc) => {
    totalAmount += doc.totalPrice;
  });

  res.status(200).json({
    success: true,
    count: orderCount,
    totalAmount,
    results: orders,
  });
});

// Update Order -- Admin
exports.updateOrder = catchAsyncError(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorHandler("Order not found.", 404));
  }

  if (order.orderStatus === "Delivered") {
    return next(new ErrorHandler("Order already delivered.", 400));
  }

  if (req.body.status === "Shipped") {
    for (const doc of order.orderItems) {
      await updateStock(doc.product, doc.quantity);
    }
  }

  order.orderStatus = req.body.status;

  if (req.body.status === "Delivered") {
    order.deliveredAt = Date.now();
  }

  await order.save();

  res.status(200).json({
    success: true,
    message: "Order status updated.",
  });
});

async function updateStock(id, qty) {
  const product = await Product.findById(id);

  product.stock -= qty;

  await product.save();
}

// Delete Order -- Admin
exports.deleteOrder = catchAsyncError(async (req, res, next) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorHandler("Order not found.", 404));
  }

  await order.deleteOne();

  res.status(200).json({
    success: true,
    message: "Order deleted successfully.",
  });
});
