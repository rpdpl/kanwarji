const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const querystring = require("querystring");
const cloudinary = require("cloudinary").v2;
const {
  User,
  Cart,
  Address,
  Order,
  SellerRequest,
  Item,
  OTP,
  CancellationRequest,
} = require("../models");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { generateOTP, generateOrderId, calculateBilledWeight } = require("../utils/ids");
const { shouldUseInstamojoForPincode, getShippingEstimate } = require("../utils/pincode");
const { generateInvoicePDF } = require("../utils/invoice");
const env = require("../config/env");
const email = require("../../services/email");
const {
  instamojoClient,
  processInstamojoRefund,
} = require("../../services/instamojo");
const shiprocket = require("../../services/shiprocket");

const {
  sendSignupMail,
  sendPaymentSuccessEmail,
  sendOrderConfirmationEmail,
  sendOrderCancellationEmail,
  sendMail,
  formatIST,
  transporter,
} = email;

const SERVER_BASE_URL = env.SERVER_BASE_URL;
const CLIENT_BASE_URL = env.CLIENT_BASE_URL;
const BYPASS_PAYMENT_FOR_TESTING = env.BYPASS_PAYMENT_FOR_TESTING;
const JWT_SECRET = env.JWT_SECRET;

async function createDelhiveryPickupRequest(order) {
  console.log(`[ORDER ${order.orderId}] Delhivery pickup skipped (integration removed)`);
  return {
    success: false,
    message: "Delhivery pickup has been removed. Use Shiprocket for shipping.",
  };
}


module.exports = function registerMiscRoutes(app) {
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});
app.get("/order-success", (req, res) => {
    const orderId = req.query.orderId || "";
    res.redirect(`/orders?success=1&orderId=${encodeURIComponent(orderId)}`);
});

app.get("/payment-failed", (req, res) => {
    const orderId = req.query.orderId || "";
    res.redirect(`/orders?failed=1&orderId=${encodeURIComponent(orderId)}`);
});
};
