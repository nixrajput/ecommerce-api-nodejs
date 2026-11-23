const cloudinary = require("cloudinary");
const mongoose = require("mongoose");
const { runApp, closeApp } = require("./app");
const initModules = require("./initModules");

const app = runApp();

// Config
if (process.env.NODE_ENV !== "production" || process.env.NODE_ENV !== "prod") {
  require("dotenv").config({
    path: "./.env.local",
  });

  console.log("[.env]: env values loaded");
}

// Cloudinary Setup
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const port = process.env.PORT || 4000;

// Connecting to DB
let connected = false;

const connectToDatabase = async function () {
  console.log("[database]: connecting to MongoDB...");
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.DB_NAME,
      autoIndex: true,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 60000,
    });
  } catch (err) {
    console.log(`[database]: could not connect due to [${err.message}]`);
    setTimeout(connectToDatabase, 10000);
    return;
  }

  connected = true;
  console.log(`[database]: connected successfully to MongoDB`);
};

const startServer = async function () {
  // Health Route
  app.route("/api/v1/health").get(function (req, res) {
    res.status(200).json(
      connected
        ? { success: true, server: "online", message: "server is up and running" }
        : {
            success: true,
            server: "offline",
            message: "server is down due to database connection error",
          }
    );
  });

  // Registered once, ahead of the modules: Express cannot remove a route after a later connect succeeds.
  app.use((req, res, next) => {
    if (connected) {
      return next();
    }
    res.status(500).json({
      success: false,
      server: "offline",
      message: "[server] offline due to database error",
    });
  });

  // Init Modules
  initModules(app);

  // Error Handler
  closeApp(app);

  // Listen after the first attempt, so a cold start serves its first request from the database.
  await connectToDatabase();

  const server = app.listen(port, (err) => {
    if (err) {
      console.log(`[server] could not start http server on port: ${port}`);
      return;
    }
    console.log(`[server] running on port: ${port}`);
  });

  // Handling Uncaught Exception
  process.on("uncaughtException", (err) => {
    console.log(`Error: ${err.message}`);
    console.log(`[server] shutting down due to Uncaught Exception`);

    server.close(() => {
      process.exit(1);
    });
  });

  // Unhandled Promise Rejection
  process.on("unhandledRejection", (err) => {
    console.log(`Error: ${err.message}`);
    console.log(`[server] shutting down due to Unhandled Promise Rejection`);

    server.close(() => {
      process.exit(1);
    });
  });
};

// Starting Server
(async () => {
  if (process.env.SERVER_MAINTENANCE === "true") {
    // Health Route
    app.route("/api/v1/health").get(function (req, res) {
      return res.status(200).json({
        success: false,
        server: "maintenance",
        message: "Server is under maintenance",
      });
    });

    app.use((req, res, next) => {
      res.status(503).json({
        success: false,
        server: "maintenance",
        message: "[server] offline for maintenance",
      });
    });

    app.listen(port, (err) => {
      if (err) {
        console.log(`[server] could not start http server on port: ${port}`);
        return;
      }
      console.log(`[server] running on port: ${port}`);
    });
  } else {
    startServer();
  }
})();
