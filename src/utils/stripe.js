const Stripe = require("stripe");

// Built on each call: Stripe throws without a key, and dotenv loads after the modules.
exports.client = () => Stripe(process.env.STRIPE_SECRET_KEY);
