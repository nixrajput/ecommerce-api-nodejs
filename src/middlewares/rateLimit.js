const { rateLimit } = require("express-rate-limit");

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const message = (text) => ({ success: false, message: text });

// ponytail: the memory store counts per process (per serverless instance). Use a shared store for global limits.
exports.generalLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: message("Too many requests, please try again later."),
});

exports.authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: message("Too many attempts, please try again in 15 minutes."),
});
