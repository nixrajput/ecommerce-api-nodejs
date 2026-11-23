const catchAsyncError = require("../../../middlewares/catchAsyncError");
const Stripe = require("stripe");

// Process Payment
exports.createPayment = catchAsyncError(async (req, res, next) => {
  // Built per request: Stripe throws without a key, and dotenv loads after this module.
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  const myPayment = await stripe.paymentIntents.create({
    amount: req.body.amount,
    currency: "inr",
    receipt_email: req.body.email,
    metadata: {
      company: "NixLab Shop",
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
