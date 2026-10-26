require("dotenv").config();

const PORT = process.env.PORT || 3000;

module.exports = {
  PORT,
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI: (process.env.MONGODB_URI || "mongodb://localhost:27017/test").replace(
    /^MONGODB_URI=/,
    ""
  ),
  JWT_SECRET: process.env.JWT_SECRET || "your-secret-key",
  SERVER_BASE_URL:
    process.env.SERVER_BASE_URL || `http://localhost:${PORT}`,
  CLIENT_BASE_URL: process.env.CLIENT_BASE_URL || "http://localhost:5173",
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || "gmail",
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  INSTAMOJO_API_KEY:
    process.env.INSTAMOJO_API_KEY || process.env.INSTAMOJO_KEY || "",
  INSTAMOJO_AUTH_TOKEN:
    process.env.INSTAMOJO_AUTH_TOKEN || process.env.INSTAMOJO_TOKEN || "",
  SHIPROCKET_EMAIL: process.env.SHIPROCKET_EMAIL,
  SHIPROCKET_PASSWORD: process.env.SHIPROCKET_PASSWORD,
  SHIPROCKET_CHANNEL_ID: process.env.SHIPROCKET_CHANNEL_ID,
  SHIPROCKET_PICKUP_LOCATION: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
  SHIPROCKET_PICKUP_POSTCODE: process.env.SHIPROCKET_PICKUP_POSTCODE || "110006",
  SHIPROCKET_PICKUP_LAT: process.env.SHIPROCKET_PICKUP_LAT,
  SHIPROCKET_PICKUP_LONG: process.env.SHIPROCKET_PICKUP_LONG,
  BYPASS_PAYMENT_FOR_TESTING: false,
};
