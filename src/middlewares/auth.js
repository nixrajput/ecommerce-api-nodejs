const ErrorHandler = require("../utils/errorHandler");
const catchAsyncError = require("./catchAsyncError");
const jwt = require("jsonwebtoken");
const User = require("../modules/user/models/userModel");

exports.isAuthenticatedUser = catchAsyncError(async (req, res, next) => {
  const bearerHeader = req.headers["authorization"];

  if (typeof bearerHeader !== "undefined") {
    const bearer = bearerHeader.split(" ");
    const bearerToken = bearer[1];

    const token = bearerToken;

    if (!token) {
      return next(new ErrorHandler("Please login to account.", 400));
    }

    const userData = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(userData.id);

    const validAfter = Math.max(
      req.user?.passwordChangedAt?.getTime() ?? 0,
      req.user?.tokensValidAfter?.getTime() ?? 0
    );

    if (!req.user || userData.iat < Math.floor(validAfter / 1000)) {
      return next(new ErrorHandler("Please login to account.", 401));
    }

    next();
  } else {
    return next(new ErrorHandler("Token not found in header.", 400));
  }
});

// AUthorize Roles
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ErrorHandler(`Access denied to admin area.`, 403));
    }

    next();
  };
};
