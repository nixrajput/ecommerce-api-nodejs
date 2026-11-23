const catchAsyncError = require("../../../middlewares/catchAsyncError");
const stripe = require("../../../utils/stripe");
const { priceOrder } = require("../../order/pricing");

// Process Payment
exports.createPayment = catchAsyncError(async (req, res, next) => {
  const order = await priceOrder(req.body.orderItems);

  const myPayment = await stripe.client().paymentIntents.create({
    amount: order.amount,
    currency: order.currency,
    receipt_email: req.body.email,
    metadata: {
      company: "NixLab Shop",
      user: String(req.user._id),
    },
  });

  res.status(200).json({
    success: true,
    client_secret: myPayment.client_secret,
  });
});

// Get Stripe API Key
exports.sendStripeApiKey = catchAsyncError(async (req, res, next) => {
  res.status(200).json({
    success: true,
    key: process.env.STRIPE_API_KEY,
  });
});
