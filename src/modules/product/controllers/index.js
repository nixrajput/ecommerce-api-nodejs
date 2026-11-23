const Product = require("../models/productModel");
const ErrorHandler = require("../../../utils/errorHandler");
const catchAsyncError = require("../../../middlewares/catchAsyncError");
const ApiFeatures = require("../../../utils/apiFeatures");
const cloudinary = require("cloudinary");
const mongoose = require("mongoose");

const MAX_IMAGES = 10;
const PRODUCT_FIELDS = ["name", "description", "price", "category", "stock"];

// Admins send one image as a string or several as an array. Anything else
// (e.g. {"length": 1e9}) would drive the upload loops below.
const readImages = (value) => {
  const images = typeof value === "string" ? [value] : value;

  if (
    !Array.isArray(images) ||
    images.length > MAX_IMAGES ||
    !images.every((image) => typeof image === "string")
  ) {
    throw new ErrorHandler(`Send up to ${MAX_IMAGES} images.`, 400);
  }

  return images;
};

const pickProductFields = (body) =>
  Object.fromEntries(
    PRODUCT_FIELDS.filter((key) => body[key] !== undefined).map((key) => [
      key,
      body[key],
    ])
  );

const requireId = (value, label) => {
  if (!mongoose.isObjectIdOrHexString(value)) {
    throw new ErrorHandler(`Invalid ${label} id.`, 400);
  }

  return value;
};

// Create Product -- Admin
exports.createProduct = catchAsyncError(async (req, res, next) => {
  const images = readImages(req.body.images);

  const imagesLink = [];

  for (let i = 0; i < images.length; i++) {
    const result = await cloudinary.v2.uploader.upload(images[i], {
      folder: "products",
    });

    imagesLink.push({
      public_id: result.public_id,
      url: result.secure_url,
    });
  }

  const product = await Product.create({
    ...pickProductFields(req.body),
    images: imagesLink,
    user: req.user.id,
  });

  res.status(201).json({
    success: true,
    result: product,
  });
});

// Get All Products
exports.getAllProducts = catchAsyncError(async (req, res) => {
  const resultPerPage = 4;
  const productCount = await Product.countDocuments();

  let products = await new ApiFeatures(Product.find(), req.query)
    .search()
    .filter().query;

  const filteredProductsCount = products.length;

  products = await new ApiFeatures(Product.find(), req.query)
    .search()
    .filter()
    .pagination(resultPerPage).query;

  res.status(200).json({
    success: true,
    count: productCount,
    resultPerPage,
    filteredProductsCount,
    results: products,
  });
});

// Get All Product (Admin)
exports.getAdminProducts = catchAsyncError(async (req, res, next) => {
  const products = await Product.find();

  const productCount = products.length;

  res.status(200).json({
    success: true,
    count: productCount,
    results: products,
  });
});

// Get Product Details
exports.getProductDetails = catchAsyncError(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHandler("Product not found.", 404));
  }

  res.status(200).json({
    success: true,
    result: product,
  });
});

// Update Product -- Admin
exports.updateProduct = catchAsyncError(async (req, res, next) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHandler("Product not found.", 404));
  }

  const update = pickProductFields(req.body);

  if (req.body.images !== undefined) {
    const images = readImages(req.body.images);

    for (let i = 0; i < product.images.length; i++) {
      await cloudinary.v2.uploader.destroy(product.images[i].public_id);
    }

    const imagesLink = [];

    for (let i = 0; i < images.length; i++) {
      const result = await cloudinary.v2.uploader.upload(images[i], {
        folder: "products",
      });

      imagesLink.push({
        public_id: result.public_id,
        url: result.secure_url,
      });
    }

    update.images = imagesLink;
  }

  product = await Product.findByIdAndUpdate(req.params.id, update, {
    returnDocument: "after",
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    result: product,
  });
});

// Delete Product
exports.deleteProduct = catchAsyncError(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHandler("Product not found.", 404));
  }

  for (let i = 0; i < product.images.length; i++) {
    await cloudinary.v2.uploader.destroy(product.images[i].public_id);
  }

  await product.deleteOne();

  res.status(200).json({
    success: true,
    message: "Product deleted successfully.",
  });
});

// Create or Update Review
exports.createProductReview = catchAsyncError(async (req, res, next) => {
  const { comment, productId } = req.body;
  const rating = Number(req.body.rating);

  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    return next(new ErrorHandler("Rating must be a number from 0 to 5.", 400));
  }

  const review = {
    user: req.user._id,
    name: req.user.name,
    rating: rating,
    comment: comment,
  };

  const product = await Product.findById(requireId(productId, "product"));

  if (!product) {
    return next(new ErrorHandler("Product not found.", 404));
  }

  const isReviewed = product.reviews.find(
    (doc) => doc.user.toString() === req.user._id.toString()
  );

  if (isReviewed) {
    product.reviews.forEach((doc) => {
      if (doc.user.toString() === req.user._id.toString())
        (doc.rating = rating), (doc.comment = comment);
    });
  } else {
    product.reviews.push(review);
    product.numOfReviews = product.reviews.length;
  }

  let total = 0;

  product.reviews.forEach((doc) => {
    total += doc.rating;
  });

  product.ratings = total / product.reviews.length;

  await product.save();

  res.status(200).json({
    success: true,
    message: "Review saved successfully.",
  });
});

// Get All Reviews of a Product
exports.getProductReviews = catchAsyncError(async (req, res, next) => {
  const product = await Product.findById(requireId(req.query.id, "product"));

  if (!product) {
    return next(new ErrorHandler("Product not found.", 404));
  }

  res.status(200).json({
    success: true,
    count: product.reviews.length,
    results: product.reviews,
  });
});

// Delete Review
exports.deleteReview = catchAsyncError(async (req, res, next) => {
  const productId = requireId(req.query.productId, "product");
  const reviewId = requireId(req.query.id, "review");

  const product = await Product.findById(productId);

  if (!product) {
    return next(new ErrorHandler("Product not found.", 404));
  }

  const review = product.reviews.find((doc) => doc._id.toString() === reviewId);

  if (!review) {
    return next(new ErrorHandler("Review not found.", 404));
  }

  if (
    review.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    return next(new ErrorHandler("You can only delete your own review.", 403));
  }

  const reviews = product.reviews.filter(
    (doc) => doc._id.toString() !== reviewId
  );

  let total = 0;

  reviews.forEach((doc) => {
    total += doc.rating;
  });

  let ratings;

  if (reviews.length === 0) {
    ratings = 0;
  } else {
    ratings = total / reviews.length;
  }

  const numOfReviews = reviews.length;

  await Product.findByIdAndUpdate(
    productId,
    {
      reviews,
      ratings,
      numOfReviews,
    },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  res.status(200).json({
    success: true,
    message: "Review deleted successfully.",
  });
});
