console.log("!!! SERVER STARTUP DEBUG MARKET !!!");
const BYPASS_PAYMENT_FOR_TESTING =false ; // ⚠️ Set to false for real payments
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
// Instamojo will be used for payments via server-side API
const { OAuth2Client } = require("google-auth-library");
const fetch = require("node-fetch");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const os = require("os");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");
const querystring = require('querystring');
const shiprocket = require("./services/shiprocket");
const Razorpay = require("razorpay");

require("dotenv").config();
const app = express();

// Razorpay is optional for local boot; payment routes need keys configured.
const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;
const invoicesDir = path.join(__dirname, "invoices");
if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true });
}

// Middleware
// app.use(cors())

app.use(
    cors({
        origin: "*", // your frontend domain
        // credentials: true,
        exposedHeaders: ["Authorization"],
    })
);

// Pincodes in Delhi region where Instamojo payment will be used instead of Delhivery
const DELHI_REGION_PINCODES = new Set([
    // Delhi
    "110001", "110002", "110003", "110004", "110005", "110006", "110007", "110008", "110009", "110010",
    "110011", "110012", "110013", "110014", "110015", "110016", "110017", "110018", "110019", "110020",
    "110021", "110022", "110023", "110024", "110025", "110026", "110027", "110028", "110029", "110030",
    "110031", "110032", "110033", "110034", "110035", "110036", "110037", "110038", "110039", "110040",
    "110041", "110042", "110043", "110044", "110045", "110046", "110047", "110048", "110049", "110051",
    "110052", "110053", "110054", "110055", "110056", "110057", "110058", "110059", "110060", "110061",
    "110062", "110063", "110064", "110065", "110066", "110067", "110068", "110070", "110071", "110073",
    "110074", "110075", "110076", "110078", "110081", "110082", "110083", "110084", "110085", "110086",
    "110087", "110088", "110091", "110092", "110093", "110094", "110095", "110096",
    // Noida
    "201301", "201009", "201003", "201004", "201005", "201006", "201007", "201010", "201011", "201012",
    "201013", "201102", "201201", "201204", "201206", "201302",
    // Ghaziabad
    "245101", "245201", "245205", "245207", "245208", "245301", "245304",
    // Faridabad
    "121001", "121002", "121004", "121005", "121006", "121007", "121008", "121009", "121010", "121011",
    "121101", "121102", "121103", "121105", "121106", "121107",
    // Gurgaon
    "122001", "122002", "122003", "122006", "122008", "122009", "122010", "122011", "122015", "122016",
    "122017", "122018", "122051", "122101", "122102", "122103", "122104", "122105", "122106", "122107",
    // Meerut
    "123003", "123413", "123414", "123502", "123504", "123505", "123506",
]);

// Function to determine if a pincode should use Instamojo instead of Delhivery
function shouldUseInstamojoForPincode(pincode) {
    return DELHI_REGION_PINCODES.has(pincode?.toString().trim());
}

// By Shaurya
async function getDelhiveryShippingEstimate(pincode, weight = 1, isCOD = true) {
    try {
        const DELHIVERY_TOKEN = process.env.DELHIVERY_TOKEN || "889a0fe85153498399f843c01b8bda62790a68ac";
        const RATE_URL = "https://track.delhivery.com/api/v1/rates/json/";  // Rate endpoint

        const rateData = {
            pickup_postcode: "110006",  // Your warehouse pin
            drop_postcode: pincode,
            weight: weight,
            payment_type: isCOD ? "COD" : "Prepaid",
            invoice_value: 150,  // Default or from cart subtotal
        };

        const encodedPayload = querystring.stringify({
            format: "json",
            data: JSON.stringify(rateData),
        });

        const response = await axios.post(RATE_URL, encodedPayload, {
            headers: {
                Authorization: `Token ${DELHIVERY_TOKEN}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        const estimate = response.data?.rates?.[0]?.rate || 50;  // Fallback 50 if API fails
        const buffered = estimate * 1.2;  // +20%
        return Math.round(buffered);  // Rounded to nearest rupee
    } catch (error) {
        console.error("Shipping estimate error:", error.response?.data || error.message);
        return 50;  // Fallback if API fails
    }
}

// app.use(
//   cors({
//     origin: "http://localhost:5173", // your frontend domain
//     // credentials: true,
//     exposedHeaders: ["Authorization"],
//   })
// );

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// delhivery token
// const DELHIVERY_TOKEN = "889a0fe85153498399f843c01b8bda62790a68ac";

// Serve general static assets from a public directory (optional)
// This won't throw if the directory is missing; it simply serves nothing.
app.use(express.static(path.join(__dirname, "public")));

// Serve a dynamic placeholder SVG to prevent 404s like /placeholder.svg?thumb=1
app.get("/placeholder.svg", (req, res) => {
    const isThumb = req.query.thumb === "1" || req.query.thumb === "true";
    const size = isThumb ? 64 : 256;
    const bg = "#e5e7eb"; // Tailwind gray-200
    const fg = "#9ca3af"; // Tailwind gray-400
    const text = isThumb ? "" : "No Image";
    const fontSize = Math.floor(size * 0.16);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <g fill="none" stroke="${fg}" stroke-width="2">
    <rect x="${size * 0.15}" y="${size * 0.2}" width="${size * 0.7}" height="${size * 0.6
        }" rx="${size * 0.04}"/>
    <circle cx="${size * 0.4}" cy="${size * 0.42}" r="${size * 0.08}"/>
    <path d="M ${size * 0.3} ${size * 0.6} L ${size * 0.45} ${size * 0.48} L ${size * 0.6
        } ${size * 0.62} L ${size * 0.7} ${size * 0.54}" />
  </g>
  ${text
            ? `<text x="50%" y="85%" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="${fontSize}" fill="${fg}">${text}</text>`
            : ""
        }
</svg>`;
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.type("image/svg+xml").send(svg);
});

// Instamojo credentials (from env)
const INSTAMOJO_API_KEY = process.env.INSTAMOJO_API_KEY || process.env.INSTAMOJO_KEY || "";
const INSTAMOJO_AUTH_TOKEN = process.env.INSTAMOJO_AUTH_TOKEN || process.env.INSTAMOJO_TOKEN || "";
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:5173";

// Simple helper to call Instamojo API
const instamojoClient = axios.create({
    baseURL: "https://www.instamojo.com/api/1.1/",
    headers: {
        "X-Api-Key": INSTAMOJO_API_KEY,
        "X-Auth-Token": INSTAMOJO_AUTH_TOKEN,
        "Content-Type": "application/json",
    },
});

// Google OAuth2 Client
const GOOGLE_CLIENT_ID =
    process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// MongoDB Connection
// Normalize MONGODB_URI in case a literal prefix was included
const mongoUri = (process.env.MONGODB_URI || "mongodb://localhost:27017/test").replace(/^MONGODB_URI=/, "");

mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,

})
    .then(() => console.log("Mongo connected"))
    .catch((err) => console.log("Error:", err));

mongoose.connection.on("connected", () => {
    console.log("MongoDB connected successfully");
});

// Cart Schema - NEW
const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
        {
            productId: { type: String, required: true }, // Can be ObjectId or string
            name: { type: String, required: true },
            price: { type: Number, required: true },
            imageUrl: { type: String },
            category: { type: String },
            unit: { type: String, required: true },
            quantity: { type: Number, required: true, min: 1 },
            discount: { type: Number, default: 0 }, // Discount percentage (0-100)
            tax: { type: Number, default: 0 }, // Tax percentage (0-100)
            hasVAT: { type: Boolean, default: false }, // VAT applicability
            addedAt: { type: Date, default: Date.now },
        },
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// Create compound index for efficient queries
cartSchema.index({ userId: 1 });
cartSchema.index({ userId: 1, "items.productId": 1 });

// Address Schema
const addressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true }, // Home, Office, etc.
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// Order Schema
const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderId: { type: String, unique: true, required: true },
    items: [
        {
            itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
            name: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true },
            sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            sellerName: { type: String },
            unit: { type: String },
            variantLabel: { type: String },
            tax: { type: Number, default: 0 },
            discount: { type: Number, default: 0 },
        },
    ],
    address: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
    },
    paymentMethod: { type: String, enum: ["cod", "online"], required: true },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded"],
        default: "pending",
    },
    paymentId: { type: String }, // Instamojo payment ID
    paymentRequestId: { type: String }, // Instamojo payment request ID
    subtotal: { type: Number, required: true },
    weight: { type: Number, default: 0 },
    shiprocketFee: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    specialRequests: { type: String, default: null, maxLength: 200 },
    remarks: { type: String, default: "", maxLength: 500 }, // Admin/seller remarks for order updates
    convenienceFee: { type: Number, default: 0 },
    orderStatus: {
        type: String,
        enum: [
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
            "cancellation-pending",
        ],
        default: "pending",
    },

    shiprocketOrderId: { type: String }, // Shiprocket order_id returned on order creation
    awbNumber: { type: String }, // Air Waybill (AWB) number when shipment/label is generated
    shipmentStatus: { type: String, default: "pending" },
    shiprocketError: { type: String },
    estimatedShiprocket: { type: Date },
    shiprocketAt: { type: Date },
    cancelledAt: { type: Date },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    cancellationReason: { type: String },
    cancellationInitiatedBy: { type: String, enum: ["user", "admin"], default: "user" }, // Who initiated cancellation
    adminRemarks: { type: String, default: "" }, // Admin remarks for cancellation
    delhiveryError: { type: String, default: "" }, // Track Delhivery creation errors
    pickupRequestId: { type: String }, // Delhivery pickup request ID
    pickupStatus: { type: String, default: "pending" }, // pending, created, confirmed, picked, failed
    pickupRequestError: { type: String, default: "" }, // Track pickup request errors
    isLocalShiprocket: { type: Boolean, default: false }, // Flag for local/COD only orders
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// User Schema - Updated with address reference
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userType: {
        type: String,
        enum: ["buyer", "seller", "admin"],
        default: "buyer",
    },
    profileImage: { type: String },
    storeName: { type: String },
    storeAddress: { type: String },
    businessLicense: { type: String },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sellerRequestStatus: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
    },
    // Address fields removed from user schema as we now have separate Address model
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const sellerRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    storeName: { type: String, required: true },
    storeAddress: { type: String, required: true },
    businessLicense: { type: String },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },
    createdAt: { type: Date, default: Date.now },
});

const itemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    productDetails: { type: String, required: true },
    // Top-level price/quantity/unit are kept for backward compatibility but
    // preferred approach is to use `variants` (array) for price/quantity per label.
    price: { type: Number },
    category: { type: String, required: true },
    imageUrl: { type: String },
    images: [{ type: String, default: undefined }], // up to 4 images, keep imageUrl for backward compatibility
    videoUrl: { type: String },
    quantity: { type: Number },
    unit: { type: String },
    // Variants: [{ label: '1kg', price: 120, quantity: 10 }]
    variants: [
        {
            label: { type: String, required: true },
            price: { type: Number, required: true },
            quantity: { type: Number, required: true, min: 0 },
        },
    ],
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    sellerName: { type: String, required: true },
    storeName: { type: String },
    isAvailable: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    discount: { type: Number, default: 0 }, // Discount percentage (0-100)
    tax: { type: Number, default: 0 }, // Tax percentage (0-100)
    hasVAT: { type: Boolean, default: false },
    isSpecialItem: { type: Boolean, default: false },
});

const otpSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otp: { type: String, required: true },
    token: { type: String },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
});

const cancellationRequestSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderIdStr: { type: String, required: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerPhone: { type: String, required: true },
    cancellationReason: { type: String, required: true },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
    },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, required: true },
    paymentId: { type: String },
    items: [
        {
            name: { type: String },
            quantity: { type: Number },
            price: { type: Number },
        },
    ],
    address: {
        name: { type: String },
        phone: { type: String },
        address: { type: String },
        city: { type: String },
        state: { type: String },
        pincode: { type: String },
    },
    adminRemarks: { type: String, default: "" },
    adminResponse: { type: String, default: "" },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    processedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// Models
const User = mongoose.model("User", userSchema);
const Cart = mongoose.model("Cart", cartSchema);
const Address = mongoose.model("Address", addressSchema);
const Order = mongoose.model("Order", orderSchema);
const SellerRequest = mongoose.model("SellerRequest", sellerRequestSchema);
const Item = mongoose.model("Item", itemSchema);
const OTP = mongoose.model("OTP", otpSchema);
const CancellationRequest = mongoose.model("CancellationRequest", cancellationRequestSchema);

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});
transporter.verify((err, success) => {
    if (err) {
        console.error("Email transporter verification failed:", err?.message || err);
    } else {
        console.log("Email transporter is ready to send messages");
    }
});
// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
        return res
            .status(401)
            .json({ success: false, message: "Access token required" });
    }
    jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key",
        (err, user) => {
            if (err) {
                return res
                    .status(403)
                    .json({ success: false, message: "Invalid token" });
            }
            req.user = user;
            next();
        }
    );
};

// Admin Middleware
const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.userType !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required",
            });
        }
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error verifying admin status",
        });
    }
};

// Generate a 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate unique order ID
function generateOrderId() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
    return `ORD${timestamp}${random}`;
}

// Calculate billed weight based on new slabs:
// 1 gms - 250 gms -> 0.5 kg
// 251 gms - 750 gms -> 1.0 kg
// 756 gms - 1.75 kgs -> 2.0 kg
// 1.76 kgs - 2.75 kgs -> 3.0 kg
function calculateBilledWeight(w) {
    const weight = parseFloat(w);
    if (isNaN(weight) || weight <= 0) return 0.5;

    // Idempotency check: if weight is already 0.5 or a whole number >= 1, 
    // it's likely already a billed weight.
    if (weight === 0.5) return 0.5;
    if (weight >= 1.0 && Number.isInteger(weight)) return weight;

    if (weight <= 0.25) return 0.5;
    if (weight <= 0.75) return 1.0;
    return Math.ceil(weight - 0.75) + 1;
}

// Create Instamojo payment request endpoint
app.post("/api/create-instamojo-payment", authenticateToken, async (req, res) => {
    try {
        const { orderData } = req.body;
        if (!orderData) return res.status(400).json({ success: false, message: "orderData required" });

        const userId = req.user.id;
        console.log(`[INSTAMOJO PAYMENT] Creating payment for user ${userId}, amount: ${orderData.totalAmount}`);

        // Check if pincode is in Instamojo region
        let finalShiprocketFee = orderData.shiprocketFee || 0;
        let finalTotalAmount = orderData.totalAmount || 0;

        const pincode = orderData.address?.pincode;
        if (shouldUseInstamojoForPincode(pincode)) {
            // Pincode is in Instamojo region - bypass Shiprocket and set shipping to ZERO
            console.log(`[INSTAMOJO PAYMENT] Pincode ${pincode} is in Instamojo region - Setting shipping to ZERO`);
            finalShiprocketFee = 0;
            // Recalculate totalAmount: subtotal + 0 shipping + tax
            finalTotalAmount = (orderData.subtotal || 0) + 0 + (orderData.taxAmount || 0);
        } else {
            // Pincode is NOT in Instamojo region - use Shiprocket shipping that's already in orderData
            console.log(`[INSTAMOJO PAYMENT] Pincode ${pincode} is NOT in Instamojo region - Using Shiprocket shipping`);
        }

        // Create an order record with pending payment
        // Map items to preserve variant/unit info and include convenience fee if provided
        // Normalize items coming from orderData.items
        const itemsIn = (orderData.items || []);
        const mappedItems = itemsIn.map((it) => ({
            itemId: it.itemId || it.productId || null,
            name: String(it.name || ""),
            price: Number(it.price || 0),
            quantity: Number(it.quantity || 0),
            unit: String(it.unit || ""),             // always string
            variantLabel: String(it.variantLabel || ""), // always string
            sellerId: it.sellerId || null,
            sellerName: it.sellerName || "",
            tax: Number(it.tax || 0),
            discount: Number(it.discount || 0),
        }));
        const convenienceFee = Number(orderData.convenienceFee || 0);

        // STEP 1: Create an order record with PENDING payment status
        // This order will NOT be confirmed until payment is verified at Instamojo
        const order = new Order({
            userId: userId,
            orderId: generateOrderId(),
            items: mappedItems,
            address: orderData.address,
            paymentMethod: "online",
            paymentStatus: "pending",              // NOT PAID YET
            orderStatus: "pending",                // NOT CONFIRMED YET
            subtotal: orderData.subtotal || 0,
            weight: calculateBilledWeight(orderData.weight || 0),
            shiprocketFee: finalShiprocketFee,
            taxAmount: orderData.taxAmount || 0,
            convenienceFee,                        // persist fee
            totalAmount: finalTotalAmount,
            specialRequests: orderData.specialRequests || "",
        });

        try {
            await order.validate();
        } catch (e) {
            console.error(`[INSTAMOJO PAYMENT] Order validation failed:`, e.message);
            return res.status(400).json({ success: false, message: e.message });
        }

        await order.save();
        console.log(`[INSTAMOJO PAYMENT] Order created with PENDING payment - orderId: ${order.orderId}, DB ID: ${order._id}`);

        // Get user info for buyer details
        const user = await User.findById(userId);

        // STEP 2: Build payment verification callback URL
        // Instamojo will redirect back here after payment so we can verify
        const redirectUrl = `${SERVER_BASE_URL}/api/instamojo-callback?orderId=${order._id}`;
        console.log(`[INSTAMOJO PAYMENT] Callback URL (for payment verification): ${redirectUrl}`);

        // STEP 3: Create payment request at Instamojo
        const payload = {
            purpose: `Order ${order.orderId}`,
            amount: String(order.totalAmount),
            buyer_name: order.address?.name || user?.name || "Customer",
            email: user?.email || "",
            phone: order.address?.phone || user?.phone || "",
            redirect_url: redirectUrl,
            send_email: false,
            send_sms: false,
            allow_repeated_payments: false,
        };

        console.log(`[INSTAMOJO PAYMENT] Initiating Instamojo payment request - Amount: ${order.totalAmount}`);

        // --- BYPASS MODE ---
        if (typeof BYPASS_PAYMENT_FOR_TESTING !== 'undefined' && BYPASS_PAYMENT_FOR_TESTING === true) {
            console.log("⚠️ [BYPASS] Bypassing Instamojo payment request creation");
            const mockCallBackUrl = `${SERVER_BASE_URL}/api/instamojo-callback?orderId=${order._id}&payment_id=MOJO_MOCK_PAYMENT&payment_status=Credit`;
            return res.json({
                success: true,
                payment_url: mockCallBackUrl,
                payment_request_id: "REQ_MOCK",
                orderId: order._id,
                humanReadableOrderId: order.orderId,
                message: "BYPASS MODE: Redirecting directly to success callback."
            });
        }
        // -------------------

        const imRes = await instamojoClient.post("payment-requests/", payload);
        if (imRes.data && imRes.data.success) {
            const pr = imRes.data.payment_request;
            console.log(`[INSTAMOJO PAYMENT] Payment request created at Instamojo - Request ID: ${pr.id}, URL: ${pr.longurl}`);

            return res.json({
                success: true,
                payment_url: pr.longurl,
                payment_request_id: pr.id,
                orderId: order._id,
                humanReadableOrderId: order.orderId,
                message: "Payment initiated. User must verify payment at Instamojo before order is confirmed."
            });
        }

        console.error(`[INSTAMOJO PAYMENT] Instamojo API did not return success - Response:`, imRes.data);
        // Delete the pending order if payment request fails
        await Order.deleteOne({ _id: order._id });
        return res.status(500).json({ success: false, message: "Failed to create Instamojo payment request" });
    } catch (err) {
        console.error("[INSTAMOJO PAYMENT] Unexpected error:", err?.response?.data || err.message || err);
        return res.status(500).json({ success: false, message: "Error creating payment request" });
    }
});

// Instamojo redirect callback - user will be redirected here after payment
// Instamojo redirect callback - user will be redirected here after payment
app.get("/api/instamojo-callback", async (req, res) => {
    console.log("\n\n========================================");
    console.log("🔔 INSTAMOJO CALLBACK HIT!");
    console.log("========================================\n");
    try {
        const { payment_id, payment_status, payment_request_id, orderId } = req.query;
        console.log(`[INSTAMOJO CALLBACK] Query params:`, { payment_id, payment_status, payment_request_id, orderId });

        if (!payment_id || !orderId) {
            console.error("Instamojo callback: Missing parameters - payment_id:", payment_id, "orderId:", orderId);
            return res.status(400).send("Missing parameters");
        }

        console.log(`[INSTAMOJO CALLBACK] Processing payment_id: ${payment_id}, order: ${orderId}, status: ${payment_status}`);

        const IS_PROD = process.env.NODE_ENV === "production";
        let payment = null;
        let verified = false;

        // --- BYPASS MODE ---
        if (typeof BYPASS_PAYMENT_FOR_TESTING !== 'undefined' && BYPASS_PAYMENT_FOR_TESTING === true) {
            console.log("⚠️ [BYPASS] Bypassing Instamojo payment verification logic");
            verified = true;
            payment = { status: "Credit" };
        }
        // -------------------

        if (!verified) { // Only attempt API verification if not bypassed
            try {
                console.log(`[INSTAMOJO] Verifying payment ${payment_id} with Instamojo API...`);
                const imRes = await instamojoClient.get(`payments/${payment_id}/`);
                payment = imRes.data?.payment || null;
                // Consider payment.status authoritative over the generic success flag
                const status = String(payment?.status || "");
                const statusOk = ["Credit", "Completed", "Success"].includes(status);
                verified = statusOk || !!(imRes.data && imRes.data.success);
                console.log(`[INSTAMOJO] API Response - success:${imRes.data?.success}, status:${status}, verified:${verified}`);
            } catch (e) {
                console.error(`[INSTAMOJO] API verification failed:`, e?.response?.data || e.message);
                verified = false;
            }

            if (!verified) { // If API verification failed, check for non-prod fallback
                if (!IS_PROD && ["Credit", "Completed", "Success"].includes(String(payment_status || ""))) {
                    console.log(`[INSTAMOJO] Non-prod mode: Accepting payment status: ${payment_status}`);
                    payment = { status: String(payment_status) };
                    verified = true;
                } else {
                    console.error(`[INSTAMOJO] Payment verification failed for order ${orderId}`);
                    return res.redirect(`${CLIENT_BASE_URL}/payment-failed?orderId=${orderId}`);
                }
            }
        }

        if (payment && (payment.status === "Credit" || payment.status === "Completed" || payment.status === "Success")) {
            console.log(`[INSTAMOJO] Payment successful (${payment.status}). Updating order ${orderId}...`);

            let order = null;
            try {
                order = await Order.findById(orderId);
            } catch (_) { }

            if (!order) {
                order = await Order.findOne({ orderId });
            }

            if (!order) {
                console.error(`[INSTAMOJO] Order not found: ${orderId}`);
                return res.redirect(`${CLIENT_BASE_URL}/payment-failed?orderId=${orderId}`);
            }

            order.paymentStatus = "paid";
            order.paymentId = payment_id;
            order.paymentRequestId = payment_request_id || order.paymentRequestId;
            order.orderStatus = "confirmed";
            order.updatedAt = new Date();
            order.paidAt = new Date();

            try {
                const feeFromApi = Number(payment?.fees || payment?.convenience_fee || 0);
                const paidAmt = Number(payment?.amount || 0);
                const baseAmt = Number(order.totalAmount || 0);
                const computedFee = feeFromApi > 0 ? feeFromApi : Math.max(0, paidAmt - baseAmt);
                if (Number.isFinite(computedFee) && computedFee > 0) {
                    order.convenienceFee = computedFee;
                }
            } catch (_) { }

            await order.save();
            console.log(`[INSTAMOJO] Order ${order.orderId} updated - Status: paid`);

            // ✅ Automatically create Shiprocket Order after payment using the working API endpoint
            // NOTE: Using /api/shiprocket/create-order endpoint which is tested and working in Postman
            let shiprocketCreationAttempted = false;
            let shiprocketCreationSuccess = false;

            try {
                console.log("\n========================================");
                console.log("🚀 [SHIPROCKET] STARTING ORDER CREATION VIA API");
                console.log("========================================");
                console.log(`[SHIPROCKET] Order ID: ${order.orderId}`);
                console.log(`[SHIPROCKET] Order DB ID: ${order._id}`);
                console.log(`[SHIPROCKET] Payment Status: ${order.paymentStatus}`);
                console.log(`[SHIPROCKET] Order Status: ${order.orderStatus}`);

                const user = await User.findById(order.userId);
                if (!user) {
                    console.error(`[SHIPROCKET] User not found for userId: ${order.userId}`);
                    throw new Error(`User not found for userId: ${order.userId}`);
                }

                console.log(`[SHIPROCKET] User found: ${user.email}`);
                console.log(`[SHIPROCKET] Delivery Address: ${order.address?.city || 'N/A'}, ${order.address?.state || 'N/A'}, ${order.address?.pincode || 'N/A'}`);
                console.log(`[SHIPROCKET] Items Count: ${order.items?.length || 0}`);
                console.log(`[SHIPROCKET] Total Weight: ${order.weight || 0.5} kg`);

                // Helper function to get safe value with fallback
                const safeValue = (value, fallback) => {
                    if (value === null || value === undefined || String(value).trim() === '') {
                        return fallback;
                    }
                    return value;
                };

                // Split name into first and last name
                const fullName = safeValue(order.address?.name, "Customer");
                const nameParts = fullName.trim().split(' ');
                const firstName = nameParts[0] || "Customer";
                const lastName = nameParts.slice(1).join(' ') || "Name";

                // Prepare the payload matching the working Postman format
                // Use our platform orderId directly for Shiprocket order_id to keep it consistent everywhere
                const shiprocketOrderId = order.orderId;

                // Recompute billed weight from items if available; fallback to order.weight
                let computedTotalWeight = 0;
                if (Array.isArray(order.items)) {
                    for (const it of order.items) {
                        const w = parseFloat(it?.weight);
                        const q = Number(it?.quantity) || 0;
                        if (!isNaN(w) && w > 0 && q > 0) {
                            computedTotalWeight += w * q;
                        }
                    }
                }
                let billedW = computedTotalWeight > 0
                    ? calculateBilledWeight(computedTotalWeight)
                    : (Number(order.weight) || 0.5);
                // Keep order.weight consistent for downstream usage and persistence on next save
                order.weight = billedW;
                let boxLen = 10, boxBr = 10, boxHt = 6; // default upto 1kg
                if (billedW <= 1) {
                    boxLen = 10; boxBr = 10; boxHt = 6;
                } else if (billedW <= 2) {
                    boxLen = 15; boxBr = 15; boxHt = 10;
                } else if (billedW <= 3) {
                    boxLen = 18; boxBr = 18; boxHt = 10;
                } else if (billedW <= 4) {
                    boxLen = 20; boxBr = 20; boxHt = 12;
                } else { // upto 5 Kgs (and above default)
                    boxLen = 24; boxBr = 20; boxHt = 15;
                }

                // Ensure unique SKUs per order as Shiprocket rejects repeated SKUs
                const skuCountMapCb = new Map();
                const makeUniqueSkuCb = (base) => {
                    const key = String(base || "SKU-001");
                    const count = (skuCountMapCb.get(key) || 0) + 1;
                    skuCountMapCb.set(key, count);
                    return count === 1 ? key : `${key}-${count}`;
                };

                const apiPayload = {
                    orderId: shiprocketOrderId,
                    orderData: {
                        billingCustomerName: firstName,
                        billingLastName: lastName,
                        billingEmail: safeValue(user.email, "customer@example.com"),
                        billingPhone: safeValue(order.address?.phone, "9999999999"),
                        billingAddress: safeValue(order.address?.address, "Address not provided"),
                        billingCity: safeValue(order.address?.city, "Mumbai"),
                        billingPincode: safeValue(order.address?.pincode, "400001"),
                        billingState: safeValue(order.address?.state, "Maharashtra"),
                        billingCountry: "India",
                        shippingIsBilling: true,
                        paymentMethod: "Prepaid",
                        subtotal: Number(order.subtotal) || 100,
                        shippingCharges: Number(order.shiprocketFee) || 0,
                        transactionCharges: Number(order.convenienceFee || 0) * 1.18,
                        weight: billedW,
                        length: boxLen,
                        breadth: boxBr,
                        height: boxHt,
                        items: (order.items || []).map(item => {
                            const baseSku = safeValue(item.itemId || item.name, "SKU-001");
                            const uniqueSku = makeUniqueSkuCb(baseSku);
                            return {
                                name: safeValue(item.name, "Product"),
                                sku: uniqueSku,
                                quantity: Number(item.quantity) || 1,
                                price: Number(item.price) || 0,
                                discount: Number(item.discount) || 0,
                                tax: Number(item.tax) || 0
                            };
                        })
                    }
                };

                // Ensure at least one item exists
                if (apiPayload.orderData.items.length === 0) {
                    apiPayload.orderData.items.push({
                        name: "Order Item",
                        sku: "ITEM-001",
                        quantity: 1,
                        price: Number(order.subtotal) || 100,
                        discount: 0,
                        tax: 0
                    });
                }

                console.log("[SHIPROCKET] API Payload prepared:");
                console.log(JSON.stringify(apiPayload, null, 2));
                console.log("[SHIPROCKET] Calling /api/shiprocket/create-order endpoint...");

                shiprocketCreationAttempted = true;

                // Call Shiprocket service directly to avoid internal HTTP self-calls and timeouts
                try {
                    console.log("[SHIPROCKET] Calling service.createShiprocketOrder directly...");
                    const srResult = await shiprocket.createShiprocketOrder({
                        orderId: apiPayload.orderId,
                        ...apiPayload.orderData,
                    });

                    console.log("[SHIPROCKET] Service Response received:");
                    console.log(JSON.stringify(srResult, null, 2));

                    if (srResult && srResult.success) {
                        order.shiprocketOrderId = srResult.shiprocketOrderId || shiprocketOrderId;
                        order.shipmentStatus = "created";
                        order.shiprocketError = null;
                        await order.save();
                        shiprocketCreationSuccess = true;

                        console.log("========================================");
                        console.log(`✅ [SHIPROCKET] ORDER CREATED SUCCESSFULLY`);
                        console.log(`   Shiprocket Order ID: ${srResult.shiprocketOrderId}`);
                        console.log(`   Our Order ID: ${order.orderId}`);
                        console.log("========================================\n");
                    } else {
                        const errorMsg = srResult?.error || "Unknown error from Shiprocket service";
                        order.shiprocketError = errorMsg;
                        order.shipmentStatus = "failed";
                        await order.save();

                        console.log("========================================");
                        console.error(`❌ [SHIPROCKET] ORDER CREATION FAILED`);
                        console.error(`   Order ID: ${order.orderId}`);
                        console.error(`   Error: ${errorMsg}`);
                        console.error(`   Full Response: ${JSON.stringify(srResult, null, 2)}`);
                        console.log("========================================\n");
                    }
                } catch (apiError) {
                    const errorMsg = apiError.response?.data?.error || apiError.response?.data?.message || apiError.message || "Shiprocket service call failed";
                    order.shiprocketError = errorMsg;
                    order.shipmentStatus = "failed";
                    await order.save();

                    console.log("========================================");
                    console.error(`❌ [SHIPROCKET] SERVICE CALL FAILED`);
                    console.error(`   Order ID: ${order.orderId}`);
                    console.error(`   Error: ${errorMsg}`);
                    console.error(`   Stack: ${apiError.stack}`);
                    console.log("========================================\n");
                }

                // Send emails regardless of Shiprocket status
                try {
                    await sendPaymentSuccessEmail(user, order);
                    await sendOrderConfirmationEmail(user, order);
                    console.log(`[EMAIL] Confirmation emails sent to ${user.email}`);
                } catch (emailError) {
                    console.error(`[EMAIL] Failed to send confirmation emails:`, emailError.message);
                    // Don't throw - email failure shouldn't block the order
                }

            } catch (e) {
                console.log("========================================");
                console.error("❌ [SHIPROCKET] CRITICAL ERROR");
                console.error(`   Order ID: ${order.orderId}`);
                console.error(`   Error Message: ${e?.message}`);
                console.error(`   Error Stack: ${e?.stack}`);
                console.log("========================================\n");

                // Save error to order
                try {
                    order.shiprocketError = `Critical error: ${e?.message}`;
                    order.shipmentStatus = "failed";
                    await order.save();
                } catch (saveError) {
                    console.error("[SHIPROCKET] Failed to save error to order:", saveError.message);
                }

                // Still try to send emails even if Shiprocket failed
                try {
                    const user = await User.findById(order.userId);
                    if (user) {
                        await sendPaymentSuccessEmail(user, order);
                        await sendOrderConfirmationEmail(user, order);
                        console.log(`[EMAIL] Confirmation emails sent despite Shiprocket failure`);
                    }
                } catch (emailError) {
                    console.error(`[EMAIL] Failed to send emails:`, emailError.message);
                }
            }

            // Log final status
            console.log(`[SHIPROCKET] Final Status - Attempted: ${shiprocketCreationAttempted}, Success: ${shiprocketCreationSuccess}`);

            console.log(`[INSTAMOJO] Payment processing complete. Redirecting to payment-success...`);
            return res.redirect(`${CLIENT_BASE_URL}/payment-success?orderId=${order.orderId}`);
        }

        console.error(`[INSTAMOJO] Payment not successful. Status: ${payment?.status}`);
        return res.redirect(`${CLIENT_BASE_URL}/payment-failed?orderId=${orderId}`);
    } catch (err) {
        console.error("[INSTAMOJO] Callback error:", err?.response?.data || err.message || err);
        return res.redirect(`${CLIENT_BASE_URL}/payment-failed`);
    }
});

// Get user's past orders
app.get("/api/user/orders", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Only show paid orders that are confirmed or cancelled
        const query = {
            userId,
            paymentStatus: "paid",
            orderStatus: { $in: ["confirmed", "cancelled"] }
        };
        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        res.json({
            success: true,
            data: {
                orders,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalOrders,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });
    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.status(500).json({ success: false, message: "Failed to fetch orders" });
    }
});

// =============================================================================
// EMAIL FUNCTIONS
// =============================================================================

// Send signup email
async function sendSignupMail({ name, email, phone }) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Welcome to Our Platform!",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Welcome, ${name}!</h2>
        <p>Thank you for signing up at our platform. Here are your registration details:</p>
        <ul>
          <li><b>Name:</b> ${name}</li>
          <li><b>Email:</b> ${email}</li>
          <li><b>Phone:</b> ${phone}</li>
        </ul>
        <p>We're excited to have you on board!</p>
        <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
          This is an automated email. Please do not reply.
        </p>
      </div>
    `,
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Order confirmation email sent to ${user.email} for ${order.orderId}`);
    } catch (e) {
        console.error("Order confirmation email send failed:", e?.response?.toString?.() || e?.message || e);
        throw e;
    }
}

// Process Instamojo refund for cancelled orders
async function processInstamojoRefund(order) {
    try {
        // Only process refunds for Instamojo payments with valid payment ID
        if (order.paymentMethod !== "online" || !order.paymentId) {
            console.log(`Skipping Instamojo refund: paymentMethod=${order.paymentMethod}, paymentId=${order.paymentId}`);
            return { success: true, skipped: true };
        }

        console.log(`Processing Instamojo refund for order ${order.orderId}, transactionId: ${order.paymentId}`);

        // Request refund via Instamojo API
        const refundResponse = await instamojoClient.post("/refunds/", {
            transaction_id: order.paymentId,
            type: "RFD",
            body: `Refund for cancelled order ${order.orderId}`
        });

        console.log(`Instamojo refund response:`, refundResponse.data);

        if (refundResponse.data?.success || refundResponse.status === 201) {
            return {
                success: true,
                refundId: refundResponse.data?.refund_id,
                amount: order.totalAmount,
                status: "processed"
            };
        } else {
            console.warn(`Instamojo refund may have failed:`, refundResponse.data);
            return {
                success: false,
                error: refundResponse.data?.message || "Refund request failed"
            };
        }
    } catch (error) {
        console.error(`Instamojo refund error for order ${order.orderId}:`, error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message || "Failed to process refund"
        };
    }
}
// Format a date in IST with: DD MMM YYYY, hh:mm AM/PM (IST)
function formatIST(date) {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).formatToParts(new Date(date));

        const get = (type) => parts.find(p => p.type === type)?.value || '';
        const day = get('day');
        const month = get('month');
        const year = get('year');
        let hour = get('hour');
        const minute = get('minute');
        const dayPeriod = (get('dayPeriod') || '').toUpperCase();
        if (hour && hour.length === 1) hour = '0' + hour;
        return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod} (IST)`;
    } catch {
        return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    }
}
// Send order confirmation email
async function sendPaymentSuccessEmail(user, order) {
    const itemsList = order.items
        .map(
            (item) =>
                `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${item.name}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.quantity}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">₹${item.price}</td>
                </tr>`
        )
        .join("");

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `Payment Successful - Order ${order.orderId}`,
        html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f9f9f9;">
        <!-- Success Banner -->
        <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
          <h2 style="margin: 0; font-size: 28px; font-weight: bold;">Payment Successful!</h2>
        </div>

        <!-- Main Content -->
        <div style="padding: 30px; background-color: white;">
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Hello <strong>${user.name}</strong>,</p>
          <p style="margin: 0 0 25px 0; font-size: 14px; color: #666; line-height: 1.6;">Your payment has been successfully processed. Thank you for your order!</p>

          <!-- Payment Confirmation Box -->
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #4CAF50;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Payment Confirmation</h3>
            <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Order ID:</strong> ${order.orderId}</p>
            <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Payment Status:</strong> <span style="color: #4CAF50; font-weight: bold;">PAID ✓</span></p>
            <p><strong>Amount Paid:</strong> <span>₹${(Number(order.totalAmount || 0) + Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</span></p>
            <p><strong>Date & Time:</strong> ${formatIST(order.paidAt || order.updatedAt || order.createdAt)}</p>
          </div>

          <!-- Order Summary -->
          <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Order Summary</h3>
          <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 12px; text-align: left; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Item</th>
                <th style="padding: 12px; text-align: center; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 12px; text-align: right; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>

          <!-- Cost Breakdown -->
<div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
  <p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;">
    <span>Subtotal:</span> <strong>₹${Number(order.subtotal || 0).toFixed(2)}</strong>
  </p>
  ${order.taxAmount ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Tax:</span> <strong>₹${Number(order.taxAmount || 0).toFixed(2)}</strong></p>` : ""}
  ${order.shiprocketFee ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Shiprocket Fee:</span> <strong>₹${Number(order.shiprocketFee || 0).toFixed(2)}</strong></p>` : ""}
 ${order.convenienceFee ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Convenience Fee:</span> <strong>₹${(Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</strong></p>` : ""}
  <p style="margin: 12px 0 0 0; padding-top: 12px; border-top: 2px solid #ddd; color: #333; font-size: 16px; display: flex; justify-content: space-between;">
    <span><strong>Total Paid:</strong></span> <strong style="color: #4CAF50;">₹${(Number(order.totalAmount || 0) + Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</strong>
  </p>
</div>

          <!-- What's Next -->
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4CAF50;">
            <h3 style="margin: 0 0 12px 0; color: #2e7d32; font-size: 16px;">What's Next?</h3>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your order is confirmed and ready for processing</p>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ You will receive tracking information once your order ships</p>
          </div>

          <!-- Shiprocket Address -->
          <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #1565c0; font-size: 16px;">Shiprocket Address</h3>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">
              <strong>${order.address.name}</strong><br>
              ${order.address.phone}<br>
              ${order.address.address}<br>
              ${order.address.city}, ${order.address.state} - ${order.address.pincode}
            </p>
          </div>

          <!-- Support -->
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.6;">
            If you have any questions about your order, please don't hesitate to <strong>contact us</strong> or reply to this email. We're here to help!
          </p>

          <p style="margin: 0; font-size: 14px; color: #999;">Thank you for shopping with us! We appreciate your business.</p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0; font-size: 12px; color: #999;">
            This is an automated email. Please do not reply directly to this email.<br>
            For support, visit our website or contact us at kanwarji@rpdindia.com
          </p>
        </div>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);
}

async function sendOrderConfirmationEmail(user, order) {
    const itemsList = order.items
        .map(
            (item) =>
                `<li>${item.name} - Qty: ${item.quantity} -  ₹${item.price}</li>`
        )
        .join("");
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `Order Confirmation - ${order.orderId}`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4CAF50; text-align: center;">Order Confirmed!</h2>
        <p>Hello ${user.name},</p>
        <p>Thank you for your order. Here are the details:</p>
                <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3>Order Details</h3>
          <p><strong>Order ID:</strong> ${order.orderId}</p>
          <p><strong>Total Amount:</strong>  ₹${order.totalAmount}</p>
          <p><strong>Payment Method:</strong> ${order.paymentMethod === "cod"
                ? "Cash on Shiprocket"
                : "Online Payment"
            }</p>
          <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
          <p><strong>Estimated Shiprocket:</strong> ${order.estimatedShiprocket.toDateString()}</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3>Items Ordered</h3>
          <ul>${itemsList}</ul>
        </div>
        <div style="background-color: #f0f8ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3>Shiprocket Address</h3>
          <p>${order.address.name}<br>
          ${order.address.phone}<br>
          ${order.address.address}<br>
          ${order.address.city}, ${order.address.state} - ${order.address.pincode
            }</p>
        </div>
        <p>We'll keep you updated on your order status.</p>
        <p>Thank you for shopping with us!</p>
                <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
          This is an automated email. Please do not reply.
        </p>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);
}

// =============================================================================
// CART MANAGEMENT APIs
// =============================================================================

// Get user's cart items
app.get("/api/cart/:userId", authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        // Verify user can only access their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.json({
                success: true,
                cartItems: [],
                totalItems: 0,
                totalPrice: 0,
            });
        }

        // Calculate totals with discount and tax
        const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = cart.items.reduce((sum, item) => {
            const originalPrice = item.price;
            const discountedPrice = originalPrice * (1 - (item.discount || 0) / 100);
            const finalPrice = discountedPrice * (1 + (item.tax || 0) / 100);
            return sum + finalPrice * item.quantity;
        }, 0);

        res.json({
            success: true,
            cartItems: cart.items.map((item) => ({
                _id: item.productId,
                productId: item.productId,
                name: item.name,
                price: item.price,
                imageUrl: item.imageUrl,
                category: item.category,
                unit: item.unit,
                quantity: item.quantity,
                discount: item.discount || 0,
                tax: item.tax || 0,
                hasVAT: item.hasVAT || false,
                addedAt: item.addedAt,
            })),
            totalItems,
            totalPrice: Math.round(totalPrice * 100) / 100, // Round to 2 decimal places
        });
    } catch (error) {
        console.error("Get cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cart items",
        });
    }
});

// Add item to user's cart
app.post("/api/cart/add", authenticateToken, async (req, res) => {
    try {
        const { userId, productId, quantity = 1, unit, variantLabel, priceOverride } = req.body;

        // Verify user can only modify their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        // Fetch complete product data from database
        const product = await Item.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Find or create cart for user
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({
                userId,
                items: [],
            });
        }

        // Build identity fields for variant-aware carts
        const targetUnit = unit || product.unit || "";
        const targetVariant = variantLabel || "";
        // Check if variant-specific item already exists in cart
        const existingItemIndex = cart.items.findIndex(
            (item) => item.productId === productId && (String(item.unit || "") === String(targetUnit)) && (String(item.variantLabel || "") === String(targetVariant))
        );
        if (existingItemIndex > -1) {
            // Update quantity if item exists
            cart.items[existingItemIndex].quantity += quantity;
            cart.items[existingItemIndex].addedAt = new Date();
            // Update with latest product data
            cart.items[existingItemIndex].discount = product.discount || 0;
            cart.items[existingItemIndex].tax = product.tax || 0;
            cart.items[existingItemIndex].hasVAT = product.hasVAT || false;
            // Respect price override if provided
            const overrideNum = Number(priceOverride);
            if (!isNaN(overrideNum) && overrideNum > 0) {
                cart.items[existingItemIndex].price = overrideNum;
            }
            // Update unit/variantLabel if provided
            cart.items[existingItemIndex].unit = targetUnit;
            if (targetVariant) cart.items[existingItemIndex].variantLabel = targetVariant;
        } else {
            // Add new item to cart with complete product data
            cart.items.push({
                productId,
                name: product.name,
                // Use priceOverride if provided, otherwise product.price
                price: (!isNaN(Number(priceOverride)) && Number(priceOverride) > 0) ? Number(priceOverride) : product.price,
                imageUrl: product.imageUrl || "",
                category: product.category || "",
                unit: targetUnit,
                quantity: Number.parseInt(quantity),
                discount: product.discount || 0,
                tax: product.tax || 0,
                hasVAT: product.hasVAT || false,
                addedAt: new Date(),
                ...(targetVariant ? { variantLabel: targetVariant } : {}),
            });
        }

        cart.updatedAt = new Date();
        await cart.save();

        res.json({
            success: true,
            message: "Item added to cart successfully",
            cartItemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        });
    } catch (error) {
        console.error("Add to cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add item to cart",
        });
    }
});

// Remove item from user's cart
app.delete("/api/cart/remove", authenticateToken, async (req, res) => {
    try {
        const { userId, productId, unit, variantLabel } = req.body;
        // Verify user can only modify their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found",
            });
        }
        // Find and remove the item (variant-aware)
        const itemIndex = cart.items.findIndex(
            (item) => item.productId === productId && (typeof unit === 'undefined' || String(item.unit || '') === String(unit || '')) && (typeof variantLabel === 'undefined' || String(item.variantLabel || '') === String(variantLabel || ''))
        );
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart",
            });
        }
        cart.items.splice(itemIndex, 1);
        cart.updatedAt = new Date();
        // If cart is empty, you might want to delete the cart document
        if (cart.items.length === 0) {
            await Cart.deleteOne({ userId });
        } else {
            await cart.save();
        }
        res.json({
            success: true,
            message: "Item removed from cart successfully",
            cartItemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        });
    } catch (error) {
        console.error("Remove from cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove item from cart",
        });
    }
});






































// Update item quantity in user's cart
app.put("/api/cart/update", authenticateToken, async (req, res) => {  // Mark async here
    try {
        const { userId, productId, quantity, pincode, unit, variantLabel } = req.body;  // Add pincode & variant info
        // Verify user can only modify their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }
        if (!quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be at least 1",
            });
        }
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found",
            });
        }
        // Find and update the item (variant-aware)
        const itemIndex = cart.items.findIndex(
            (item) => item.productId === productId && (typeof unit === 'undefined' || String(item.unit || '') === String(unit || '')) && (typeof variantLabel === 'undefined' || String(item.variantLabel || '') === String(variantLabel || ''))
        );
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart",
            });
        }
        cart.items[itemIndex].quantity = Number.parseInt(quantity);
        cart.items[itemIndex].addedAt = new Date(); // Update timestamp
        cart.updatedAt = new Date();
        await cart.save();

        // Calculate totalPrice (if not defined earlier—add if missing)
        const totalPrice = cart.items.reduce((sum, item) => {
            const originalPrice = item.price;
            const discountedPrice = originalPrice * (1 - (item.discount || 0) / 100);
            const finalPrice = discountedPrice * (1 + (item.tax || 0) / 100);
            return sum + finalPrice * item.quantity;
        }, 0);

        // Fetch shipping estimate if pincode provided
        let shippingEstimate = 0;
        if (pincode) {
            shippingEstimate = await getDelhiveryShippingEstimate(pincode);  // Await OK in async handler
            cart.shippingEstimate = shippingEstimate;  // Save in cart
            await cart.save();  // Save updated cart
        }

        res.json({
            success: true,
            message: "Cart updated successfully",
            cartItemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
            shippingEstimate,  // Return for UI
            totalWithShipping: Math.round((totalPrice + shippingEstimate) * 100) / 100,  // Pre-calculate with buffer
        });
    } catch (error) {
        console.error("Update cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update cart",
        });
    }
});















// Calculate shipping rate (Delhivery Kinko API - GET)
app.post("/api/shipping-rate", async (req, res) => {
    try {
        console.log("=== Shipping Rate Calculation Started (Shiprocket) ===");
        console.log("Request body:", req.body);

        // Support both parameter formats
        const {
            destPin,
            deliveryPincode,
            pickupLocationId,
            weight = 1,
            codAmount = 0,
            orderValue = 0,
            mode = "E"
        } = req.body;

        // Use deliveryPincode if destPin is not provided
        const pincode = deliveryPincode || destPin;

        if (!pincode) {
            console.log("ERROR: No pincode provided");
            return res.status(400).json({ success: false, message: "Delivery pincode required" });
        }

        // Validate pincode format
        if (!/^\d{6}$/.test(pincode.toString())) {
            return res.status(400).json({ success: false, message: "Invalid PIN format. Must be 6 digits." });
        }

        console.log("Params: pincode=", pincode, "weight=", weight, "orderValue=", orderValue);

        // Get Shiprocket token first
        console.log("Getting Shiprocket token...");
        const token = await shiprocket.getShiprocketToken();

        if (!token) {
            throw new Error("Failed to get Shiprocket token");
        }

        console.log("✅ Token obtained, fetching rates...");

        // Call Shiprocket API directly for shipping rates
        const pickup = pickupLocationId || "110006";
        const shiprocketUrl = `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${pickup}&delivery_postcode=${pincode}&weight=${weight}`;

        console.log("Shiprocket URL:", shiprocketUrl);

        const shiprocketResponse = await axios.get(shiprocketUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        console.log("Shiprocket response received");

        if (shiprocketResponse.data.success && shiprocketResponse.data.data) {
            // Support both shapes: data.couriers and data.available_courier_companies
            const apiData = shiprocketResponse.data.data;
            const baseCouriers = Array.isArray(apiData.couriers)
                ? apiData.couriers
                : (Array.isArray(apiData.available_courier_companies) ? apiData.available_courier_companies : []);
            if (!baseCouriers.length) {
                throw new Error("No couriers available for this route from Shiprocket");
            }
            // Filter out Surface completely; only allow Air/Express (mode === 1 or is_surface === false or name contains Air/Express)
            const allCouriers = baseCouriers;
            const airCouriers = allCouriers.filter((c) => {
                // STRICT: allow only Air/Express. Exclude anything marked as surface.
                // Accept when explicitly air/express by mode or flag.
                const isAirMode = Number(c?.mode) === 1;
                const notSurface = c?.is_surface === false;
                return (isAirMode || notSurface);
            });

            if (airCouriers.length === 0) {
                throw new Error("Only surface couriers available; food items require Air/Express");
            }

            // Choose the fastest by earliest ETA hours; fallback to estimated_delivery_days; break ties by lower rate
            const fastest = airCouriers.reduce((best, cur) => {
                const bestEta = Number((best.etd_hours ?? (best.estimated_delivery_days != null ? Number(best.estimated_delivery_days) * 24 : undefined)))
                    || Number.POSITIVE_INFINITY;
                const curEta = Number((cur.etd_hours ?? (cur.estimated_delivery_days != null ? Number(cur.estimated_delivery_days) * 24 : undefined)))
                    || Number.POSITIVE_INFINITY;

                if (curEta < bestEta) return cur;
                if (curEta > bestEta) return best;
                // Tie on ETA: pick cheaper
                return (Number(cur.rate) < Number(best.rate)) ? cur : best;
            }, airCouriers[0]);

            const shippingCost = fastest.rate;

            console.log("✅ Fastest Air/Express selected: ₹", shippingCost, "via", fastest.courier_name);
            console.log("=== Shipping Rate Calculation Complete ===");

            return res.json({
                success: true,
                shippingCost,
                message: `Shipping to PIN ${pincode}: ₹${shippingCost} via ${fastest.courier_name}`,
                details: fastest,
                couriers: airCouriers,
                // Provide a Shiprocket-compatible data shape (filtered to Air/Express only)
                data: {
                    available_courier_companies: airCouriers,
                    recommended_courier_company_id: fastest.courier_company_id,
                    shiprocket_recommended_courier_id: fastest.courier_company_id,
                    // Add nested data block for clients expecting Shiprocket's nested shape
                    // Also mirror to couriers for clients reading this key
                    data: {
                        available_courier_companies: airCouriers,
                        recommended_courier_company_id: fastest.courier_company_id,
                        shiprocket_recommended_courier_id: fastest.courier_company_id,
                        // Also mirror to couriers for clients reading this key
                        couriers: airCouriers,
                    },
                    // Also expose at this level for clients reading `couriers`
                    couriers: airCouriers,
                },
            });
        } else {
            throw new Error("No couriers available for this route from Shiprocket");
        }
    } catch (error) {
        console.error("=== Shipping Rate Error ===");
        console.error("Status:", error.response?.status);
        console.error("Error Response:", error.response?.data);
        console.error("Message:", error.message);
        console.log("=== End Error ===");

        res.status(500).json({
            success: false,
            message: error.message || "Failed to calculate shipping rate",
            error: error.response?.data || error.message,
        });
    }
});



































// Clear user's entire cart
app.delete("/api/cart/clear/:userId", authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        // Verify user can only modify their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }
        await Cart.deleteOne({ userId });
        res.json({
            success: true,
            message: "Cart cleared successfully",
            cartItemCount: 0,
        });
    } catch (error) {
        console.error("Clear cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear cart",
        });
    }
});

// Get cart item count for user (utility endpoint)
app.get("/api/cart/:userId/count", authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        // Verify user can only access their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }
        const cart = await Cart.findOne({ userId });
        const count = cart
            ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
            : 0;
        res.json({
            success: true,
            count,
        });
    } catch (error) {
        console.error("Get cart count error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get cart count",
        });
    }
});

// =============================================================================
// ADDRESS MANAGEMENT APIs
// =============================================================================

// Get user addresses
app.get("/api/addresses", authenticateToken, async (req, res) => {
    try {
        const addresses = await Address.find({ userId: req.user.id })
            .sort({ isDefault: -1, createdAt: -1 })
            .limit(3); // Limit to 3 addresses as per frontend
        res.json({
            success: true,
            addresses,
        });
    } catch (error) {
        console.error("Get addresses error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch addresses",
        });
    }
});

// Add new address
app.post("/api/addresses", authenticateToken, async (req, res) => {
    try {
        const { title, name, phone, address, city, state, pincode, isDefault } =
            req.body;
        const allowedTitles = new Set(["home", "office", "other"]);
        const titleNorm = String(title || "").trim();
        const phoneDigits = String(phone || "").replace(/\D/g, "");
        const addressNorm = String(address || "").trim();
        const cityNorm = String(city || "").trim();
        const stateNorm = String(state || "").trim();
        const pincodeDigits = String(pincode || "").replace(/\D/g, "");
        // Validate required fields
        if (!titleNorm || !name || !phoneDigits || !addressNorm || !cityNorm || !stateNorm || !pincodeDigits) {
            return res.status(400).json({
                success: false,
                message: "All address fields are required",
            });
        }
        // Validate title whitelist
        if (!allowedTitles.has(titleNorm.toLowerCase())) {
            return res.status(400).json({ success: false, message: "Title must be Home, Office, or Other" });
        }
        // Validate pincode
        if (pincodeDigits.length !== 6) {
            return res.status(400).json({
                success: false,
                message: "Pincode must be 6 digits",
            });
        }
        // Validate phone
        if (phoneDigits.length !== 10) {
            return res.status(400).json({
                success: false,
                message: "Phone number must be exactly 10 digits",
            });
        }
        // Validate min lengths
        if (addressNorm.length < 10) {
            return res.status(400).json({ success: false, message: "Address must be at least 10 characters" });
        }
        if (cityNorm.length < 3) {
            return res.status(400).json({ success: false, message: "City must be at least 3 characters" });
        }
        if (stateNorm.length < 3) {
            return res.status(400).json({ success: false, message: "State must be at least 3 characters" });
        }
        // Check if user already has 3 addresses
        const existingAddresses = await Address.countDocuments({
            userId: req.user.id,
        });
        if (existingAddresses >= 3) {
            return res.status(400).json({
                success: false,
                message: "Maximum 3 addresses allowed per user",
            });
        }
        // If this is set as default, remove default from other addresses
        if (isDefault) {
            await Address.updateMany({ userId: req.user.id }, { isDefault: false });
        }
        // If this is the first address, make it default
        const shouldBeDefault = existingAddresses === 0 || isDefault;
        const newAddress = new Address({
            userId: req.user.id,
            title: titleNorm,
            name,
            phone: phoneDigits,
            address: addressNorm,
            city: cityNorm,
            state: stateNorm,
            pincode: pincodeDigits,
            isDefault: shouldBeDefault,
        });
        await newAddress.save();
        res.status(201).json({
            success: true,
            message: "Address added successfully",
            address: newAddress,
        });
    } catch (error) {
        console.error("Add address error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add address",
        });
    }
});

// Update address
app.put("/api/addresses/:id", authenticateToken, async (req, res) => {
    try {
        const addressId = req.params.id;
        const { title, name, phone, address, city, state, pincode, isDefault } =
            req.body;
        const allowedTitles = new Set(["home", "office", "other"]);
        const titleNorm = String(title || "").trim();
        const phoneDigits = String(phone || "").replace(/\D/g, "");
        const addressNorm = String(address || "").trim();
        const cityNorm = String(city || "").trim();
        const stateNorm = String(state || "").trim();
        const pincodeDigits = String(pincode || "").replace(/\D/g, "");
        const existingAddress = await Address.findOne({
            _id: addressId,
            userId: req.user.id,
        });
        if (!existingAddress) {
            return res.status(404).json({
                success: false,
                message: "Address not found",
            });
        }
        // Basic validations
        if (!titleNorm || !name || !phoneDigits || !addressNorm || !cityNorm || !stateNorm || !pincodeDigits) {
            return res.status(400).json({ success: false, message: "All address fields are required" });
        }
        if (!allowedTitles.has(titleNorm.toLowerCase())) {
            return res.status(400).json({ success: false, message: "Title must be Home, Office, or Other" });
        }
        if (phoneDigits.length !== 10) {
            return res.status(400).json({ success: false, message: "Phone number must be exactly 10 digits" });
        }
        if (pincodeDigits.length !== 6) {
            return res.status(400).json({ success: false, message: "Pincode must be 6 digits" });
        }
        if (addressNorm.length < 10) {
            return res.status(400).json({ success: false, message: "Address must be at least 10 characters" });
        }
        if (cityNorm.length < 3) {
            return res.status(400).json({ success: false, message: "City must be at least 3 characters" });
        }
        if (stateNorm.length < 3) {
            return res.status(400).json({ success: false, message: "State must be at least 3 characters" });
        }

        // If setting as default, remove default from other addresses
        if (isDefault && !existingAddress.isDefault) {
            await Address.updateMany(
                { userId: req.user.id, _id: { $ne: addressId } },
                { isDefault: false }
            );
        }
        const updatedAddress = await Address.findByIdAndUpdate(
            addressId,
            {
                title: titleNorm,
                name,
                phone: phoneDigits,
                address: addressNorm,
                city: cityNorm,
                state: stateNorm,
                pincode: pincodeDigits,
                isDefault,
                updatedAt: new Date(),
            },
            { new: true }
        );
        res.json({
            success: true,
            message: "Address updated successfully",
            address: updatedAddress,
        });
    } catch (error) {
        console.error("Update address error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update address",
        });
    }
});

// Delete address
app.delete("/api/addresses/:id", authenticateToken, async (req, res) => {
    try {
        const addressId = req.params.id;
        const address = await Address.findOneAndDelete({
            _id: addressId,
            userId: req.user.id,
        });
        if (!address) {
            return res.status(404).json({
                success: false,
                message: "Address not found",
            });
        }
        // If deleted address was default, make another address default
        if (address.isDefault) {
            const firstAddress = await Address.findOne({ userId: req.user.id });
            if (firstAddress) {
                firstAddress.isDefault = true;
                await firstAddress.save();
            }
        }
        res.json({
            success: true,
            message: "Address deleted successfully",
        });
    } catch (error) {
        console.error("Delete address error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete address",
        });
    }
});

// =============================================================================
// AUTHENTICATION APIs
// =============================================================================

// User Info Update API
app.put("/api/user/update-info", authenticateToken, async (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!name && !phone) {
            return res
                .status(400)
                .json({ success: false, message: "Nothing to update" });
        }
        if (phone) {
            const phoneExists = await User.findOne({
                phone,
                _id: { $ne: req.user.id },
            });
            if (phoneExists) {
                return res
                    .status(400)
                    .json({ success: false, message: "Phone number already exists." });
            }
        }
        const user = await User.findById(req.user.id);
        if (!user)
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
        if (name) user.name = name;
        if (phone) user.phone = phone;
        user.updatedAt = new Date();
        await user.save();
        res.json({
            success: true,
            message: "User information updated successfully",
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                userType: user.userType,
            },
        });
    } catch (error) {
        console.error("Update info error:", error);
        res
            .status(500)
            .json({ success: false, message: "Failed to update user info" });
    }
});

// Register User (With OTP verification)
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }],
        });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email or phone number.",
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            userType: "buyer",
            isVerified: false,
        });
        await user.save();
        const otp = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);
        await OTP.deleteMany({ email });
        const otpDoc = new OTP({
            email,
            otp,
            expiresAt,
        });
        await otpDoc.save();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Signup OTP Verification",
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">OTP Verification</h2>
          <p>Hello ${name},</p>
          <p>Your OTP for verifying your account is:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP will expire in 15 minutes.</p>
          <p>If you did not sign up, please ignore this email.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
            This is an automated email. Please do not reply.
          </p>
        </div>
      `,
        };
        await transporter.sendMail(mailOptions);
        res.status(201).json({
            success: true,
            message: "Account created! Please verify your email with the OTP sent.",
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred during signup. Please try again.",
        });
    }
});

// Verify Signup OTP
app.post("/api/auth/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            });
        }
        const otpDoc = await OTP.findOne({ email, otp });
        if (!otpDoc) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
            });
        }
        if (new Date() > otpDoc.expiresAt) {
            await OTP.deleteOne({ _id: otpDoc._id });
            return res.status(400).json({
                success: false,
                message: "OTP has expired",
            });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        user.isVerified = true;
        user.updatedAt = new Date();
        await user.save();
        await OTP.deleteOne({ _id: otpDoc._id });
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || "your-secret-key",
            {
                expiresIn: "7d",
            }
        );
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            profileImage: user.profileImage,
            createdAt: user.createdAt,
            isVerified: user.isVerified,
        };
        res.json({
            success: true,
            message: "Email verified successfully!",
            user: userData,
            token,
        });
    } catch (error) {
        console.error("Verify signup otp error:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while verifying OTP",
        });
    }
});

// Send OTP for password reset
app.post("/api/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: "Email is required",
            });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "No user found with this email address",
            });
        }
        const otp = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);
        await OTP.deleteMany({ email });
        const otpDoc = new OTP({
            email,
            otp,
            expiresAt,
        });
        await otpDoc.save();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset OTP",
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Password Reset</h2>
          <p>Hello ${user.name},</p>
          <p>You requested to reset your password. Please use the following OTP to verify your identity:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP will expire in 15 minutes.</p>
          <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
            This is an automated email. Please do not reply.
          </p>
        </div>
      `,
        };
        await transporter.sendMail(mailOptions);
        res.status(200).json({
            success: true,
            message: "OTP sent to your email address",
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            success: false,
            error: "An error occurred while processing your request",
        });
    }
});

// Verify OTP for password reset
app.post("/api/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                error: "Email and OTP are required",
            });
        }
        const otpDoc = await OTP.findOne({ email, otp });
        if (!otpDoc) {
            return res.status(400).json({
                success: false,
                error: "Invalid OTP",
            });
        }
        if (new Date() > otpDoc.expiresAt) {
            await OTP.deleteOne({ _id: otpDoc._id });
            return res.status(400).json({
                success: false,
                error: "OTP has expired",
            });
        }
        const token = crypto.randomBytes(32).toString("hex");
        otpDoc.token = token;
        otpDoc.expiresAt = new Date();
        otpDoc.expiresAt.setMinutes(otpDoc.expiresAt.getMinutes() + 30);
        await otpDoc.save();
        res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            token,
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        res.status(500).json({
            success: false,
            error: "An error occurred while verifying OTP",
        });
    }
});

// Reset password with token
app.post("/api/reset-password", async (req, res) => {
    try {
        const { email, token, password } = req.body;
        if (!email || !token || !password) {
            return res.status(400).json({
                success: false,
                error: "Email, token and password are required",
            });
        }
        const otpDoc = await OTP.findOne({ email, token });
        if (!otpDoc) {
            return res.status(400).json({
                success: false,
                error: "Invalid or expired token",
            });
        }
        if (new Date() > otpDoc.expiresAt) {
            await OTP.deleteOne({ _id: otpDoc._id });
            return res.status(400).json({
                success: false,
                error: "Reset token has expired",
            });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found",
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.updatedAt = new Date();
        await user.save();
        await OTP.deleteOne({ _id: otpDoc._id });
        res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            success: false,
            error: "An error occurred while resetting password",
        });
    }
});

// Login User
app.post("/api/auth/login", async (req, res) => {
    try {
        const { emailOrPhone, password } = req.body;
        const user = await User.findOne({
            $or: [
                { email: emailOrPhone },
                { phone: emailOrPhone },
                { name: emailOrPhone },
            ],
        });
        if (!user) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid credentials. Please check your email/phone and password.",
            });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid credentials. Please check your email/phone and password.",
            });
        }
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || "your-secret-key",
            {
                expiresIn: "7d",
            }
        );
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            profileImage: user.profileImage,
            storeName: user.storeName,
            storeAddress: user.storeAddress,
            isVerified: user.isVerified,
            isActive: user.isActive,
            createdAt: user.createdAt,
        };
        res.json({
            success: true,
            message: "Login successful!",
            user: userData,
            token,
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred during login. Please try again.",
        });
    }
});

// Get Current User
app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            profileImage: user.profileImage,
            storeName: user.storeName,
            storeAddress: user.storeAddress,
            businessLicense: user.businessLicense,
            isVerified: user.isVerified,
            isActive: user.isActive,
            sellerRequestStatus: user.sellerRequestStatus,
            createdAt: user.createdAt,
        };
        res.json({
            success: true,
            user: userData,
        });
    } catch (error) {
        console.error("Get user error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get user data",
        });
    }
});

// Become Seller - Updated to create seller request instead of direct conversion
app.post("/api/auth/become-seller", authenticateToken, async (req, res) => {
    try {
        const { storeName, storeAddress, businessLicense } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        // Check if user already has a pending or approved request
        const existingRequest = await SellerRequest.findOne({
            userId: user._id,
            status: { $in: ["pending", "approved"] },
        });
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: `You already have a ${existingRequest.status} seller request.`,
            });
        }
        if (user.userType === "seller") {
            return res.status(400).json({
                success: false,
                message: "You are already a seller.",
            });
        }
        // Create seller request
        const sellerRequest = new SellerRequest({
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            storeName,
            storeAddress,
            businessLicense,
        });
        await sellerRequest.save();
        // Update user status
        user.sellerRequestStatus = "pending";
        user.updatedAt = new Date();
        await user.save();
        res.json({
            success: true,
            message:
                "Seller request submitted successfully! Please wait for admin approval.",
            request: {
                id: sellerRequest._id,
                status: sellerRequest.status,
                createdAt: sellerRequest.createdAt,
            },
        });
    } catch (error) {
        console.error("Become seller error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit seller request. Please try again.",
        });
    }
});

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// Get Admin Dashboard Stats
app.get(
    "/api/admin/stats",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const totalUsers = await User.countDocuments({
                userType: { $ne: "admin" },
            });
            const totalSellers = await User.countDocuments({ userType: "seller" });
            const pendingRequests = await SellerRequest.countDocuments({
                status: "pending",
            });
            const activeSellers = await User.countDocuments({
                userType: "seller",
                isActive: true,
            });
            const totalProducts = await Item.countDocuments({});
            const availableProducts = await Item.countDocuments({
                isAvailable: true,
            });
            const hiddenProducts = await Item.countDocuments({ isAvailable: false });
            const totalOrders = await Order.countDocuments({});

            const stats = {
                totalUsers,
                totalSellers,
                pendingRequests,
                activeSellers,
                totalProducts,
                availableProducts,
                hiddenProducts,
                totalOrders,
            };
            res.json({
                success: true,
                stats,
            });
        } catch (error) {
            console.error("Get admin stats error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch admin statistics",
            });
        }
    }
);

// Get Seller Requests
app.get(
    "/api/admin/seller-requests",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { status, page = 1, limit = 10 } = req.query;
            const query = {};
            if (status) {
                query.status = status;
            }
            const requests = await SellerRequest.find(query)
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .populate("userId", "name email phone")
                .populate("processedBy", "name email");
            const total = await SellerRequest.countDocuments(query);
            res.json({
                success: true,
                requests,
                totalPages: Math.ceil(total / limit),
                currentPage: Number.parseInt(page),
                totalRequests: total,
            });
        } catch (error) {
            console.error("Get seller requests error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch seller requests",
            });
        }
    }
);

// Approve Seller Request
app.post(
    "/api/admin/seller-requests/:id/approve",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const sellerRequest = await SellerRequest.findById(requestId);
            if (!sellerRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Seller request not found",
                });
            }
            if (sellerRequest.status !== "pending") {
                return res.status(400).json({
                    success: false,
                    message: "This request has already been processed",
                });
            }
            // Update seller request
            sellerRequest.status = "approved";
            sellerRequest.processedAt = new Date();
            sellerRequest.processedBy = adminId;
            await sellerRequest.save();
            // Update user to seller
            const user = await User.findById(sellerRequest.userId);
            if (user) {
                user.userType = "seller";
                user.storeName = sellerRequest.storeName;
                user.storeAddress = sellerRequest.storeAddress;
                user.businessLicense = sellerRequest.businessLicense;
                user.sellerRequestStatus = "approved";
                user.isVerified = true;
                user.updatedAt = new Date();
                await user.save();
            }
            res.json({
                success: true,
                message: "Seller request approved successfully",
                request: sellerRequest,
            });
        } catch (error) {
            console.error("Approve seller request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to approve seller request",
            });
        }
    }
);

// Reject Seller Request
app.post(
    "/api/admin/seller-requests/:id/reject",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const { reason } = req.body;
            const sellerRequest = await SellerRequest.findById(requestId);
            if (!sellerRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Seller request not found",
                });
            }
            if (sellerRequest.status !== "pending") {
                return res.status(400).json({
                    success: false,
                    message: "This request has already been processed",
                });
            }
            // Update seller request
            sellerRequest.status = "rejected";
            sellerRequest.processedAt = new Date();
            sellerRequest.processedBy = adminId;
            sellerRequest.rejectionReason = reason;
            await sellerRequest.save();
            // Update user status
            const user = await User.findById(sellerRequest.userId);
            if (user) {
                user.sellerRequestStatus = "rejected";
                user.updatedAt = new Date();
                await user.save();
            }
            res.json({
                success: true,
                message: "Seller request rejected successfully",
                request: sellerRequest,
            });
        } catch (error) {
            console.error("Reject seller request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to reject seller request",
            });
        }
    }
);

// Get All Sellers
app.get(
    "/api/admin/sellers",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { page = 1, limit = 10, search, status } = req.query;
            const query = { userType: "seller" };
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { storeName: { $regex: search, $options: "i" } },
                ];
            }
            if (status) {
                query.isActive = status === "active";
            }
            const sellers = await User.find(query)
                .select("-password")
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);
            const total = await User.countDocuments(query);
            res.json({
                success: true,
                sellers,
                totalPages: Math.ceil(total / limit),
                currentPage: Number.parseInt(page),
                totalSellers: total,
            });
        } catch (error) {
            console.error("Get sellers error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch sellers",
            });
        }
    }
);

// Toggle Seller Status (Activate/Deactivate)
app.patch(
    "/api/admin/sellers/:id/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const sellerId = req.params.id;
            const { isActive } = req.body;
            const seller = await User.findOne({
                _id: sellerId,
                userType: "seller",
            });
            if (!seller) {
                return res.status(404).json({
                    success: false,
                    message: "Seller not found",
                });
            }
            seller.isActive = isActive;
            seller.updatedAt = new Date();
            await seller.save();
            // If deactivating, also deactivate all their items
            if (!isActive) {
                await Item.updateMany(
                    { sellerId: sellerId },
                    { isAvailable: false, updatedAt: new Date() }
                );
            }
            res.json({
                success: true,
                message: `Seller ${isActive ? "activated" : "deactivated"
                    } successfully`,
                seller: {
                    id: seller._id,
                    name: seller.name,
                    email: seller.email,
                    isActive: seller.isActive,
                },
            });
        } catch (error) {
            console.error("Toggle seller status error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update seller status",
            });
        }
    }
);
app.get("/api/admin-items", async (req, res) => {
    try {
        const {
            category,
            search,
            page = 1,
            limit = 20,
            status = "available",
        } = req.query;

        // Query to find only admin-added items
        const query = {
            sellerName: "admin", // Items added by admin have sellerName as "admin"
        };

        // By default, only show available items for public API
        // You can change this behavior by modifying the default status
        if (status === "available") {
            query.isAvailable = true;
        } else if (status === "hidden") {
            query.isAvailable = false;
        } else if (status === "all") {
            // Don't filter by availability - show all admin items
        } else {
            // Default to available items
            query.isAvailable = true;
        }

        // Filter by category
        if (category) {
            query.category = { $regex: category, $options: "i" };
        }

        // Search functionality
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { productDetails: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
            ];
        }

        const items = await Item.find(query)
            .select(
                "name productDetails  price category imageUrl images videoUrl quantity unit variants sellerId sellerName storeName discount tax hasVAT isAvailable createdAt updatedAt isSpecialItem"
            ) // include images, videoUrl
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Item.countDocuments(query);

        res.json({
            success: true,
            items,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            totalItems: total,
            message: "Admin items retrieved successfully",
        });
    } catch (error) {
        console.error("Get admin items error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch admin items",
        });
    }
});

// Admin: Toggle Item Availability
app.patch(
    "/api/admin/items/:id/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const itemId = req.params.id;
            const { isAvailable } = req.body;
            const item = await Item.findById(itemId);
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: "Item not found",
                });
            }
            item.isAvailable = !!isAvailable;
            item.updatedAt = new Date();
            await item.save();
            res.json({
                success: true,
                message: `Item ${isAvailable ? "activated (visible)" : "deactivated (hidden)"
                    } successfully`,
                item: {
                    id: item._id,
                    name: item.name,
                    isAvailable: item.isAvailable,
                },
            });
        } catch (error) {
            console.error("Admin toggle item status error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update item status",
            });
        }
    }
);

// Get All Users (for admin)
app.get(
    "/api/admin/users",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { page = 1, limit = 10, search, userType } = req.query;
            const query = { userType: { $ne: "admin" } };
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                ];
            }
            if (userType && userType !== "all") {
                query.userType = userType;
            }
            const users = await User.find(query)
                .select("-password")
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);
            const total = await User.countDocuments(query);
            res.json({
                success: true,
                users,
                totalPages: Math.ceil(total / limit),
                currentPage: Number.parseInt(page),
                totalUsers: total,
            });
        } catch (error) {
            console.error("Get users error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch users",
            });
        }
    }
);

// Create Admin User (Run this once to create your first admin)
app.post("/api/create-admin", async (req, res) => {
    try {
        const { name, email, phone, password, secretKey } = req.body;
        // Use a secret key to protect this endpoint
        if (secretKey !== "create-admin-secret-2024") {
            return res.status(401).json({
                success: false,
                message: "Invalid secret key",
            });
        }
        // Check if admin already exists
        const existingAdmin = await User.findOne({ userType: "admin" });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: "Admin user already exists",
            });
        }
        // Check if user with email/phone already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }],
        });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email or phone number.",
            });
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create admin user
        const admin = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            userType: "admin",
            isVerified: true,
        });
        await admin.save();
        res.status(201).json({
            success: true,
            message: "Admin user created successfully!",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                userType: admin.userType,
            },
        });
    } catch (error) {
        console.error("Create admin error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create admin user",
        });
    }
});

// Toggle User Status (Activate/Deactivate) - For admin
app.patch(
    "/api/admin/users/:id/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const userId = req.params.id;
            const { isActive } = req.body;
            // Prevent admin from changing their own status or other admins
            const user = await User.findOne({
                _id: userId,
                userType: { $ne: "admin" },
            });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found or you cannot modify admin status",
                });
            }
            user.isActive = isActive;
            user.updatedAt = new Date();
            await user.save();
            // If user is a seller, also update their items' isAvailable status
            if (user.userType === "seller") {
                await Item.updateMany(
                    { sellerId: userId },
                    { isAvailable: !!isActive, updatedAt: new Date() }
                );
            }
            res.json({
                success: true,
                message: `User ${isActive ? "activated" : "deactivated"} successfully`,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    isActive: user.isActive,
                    userType: user.userType,
                },
            });
        } catch (error) {
            console.error("Toggle user status error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update user status",
            });
        }
    }
);

// =============================================================================
// ITEM/PRODUCT MANAGEMENT APIs
// =============================================================================

// Add Item (Sellers only) - Updated to check seller status
app.post("/api/items", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.userType !== "seller" && user.userType !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only approved sellers can add items",
            });
        }
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message:
                    "Your seller account is currently deactivated. Please contact admin.",
            });
        }
        const { name, productDetails, price, category, imageUrl, quantity, unit } =
            req.body;
        const item = new Item({
            name,
            productDetails,
            price,
            category,
            imageUrl,
            quantity,
            unit,
            sellerId: user._id,
            sellerName: user.name,
            storeName: user.storeName || user.name,
        });
        await item.save();
        res.status(201).json({
            success: true,
            message: "Item added successfully!",
            item,
        });
    } catch (error) {
        console.error("Add item error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add item. Please try again.",
        });
    }
});

// Get All Items - Updated to only show items from active sellers
app.get("/api/items", async (req, res) => {
    try {
        const { category, search, page = 1, limit = 20 } = req.query;

        // First get active sellers
        const activeSellers = await User.find({
            userType: "seller",
            isActive: true,
        }).select("_id");
        const activeSellerIds = activeSellers.map((seller) => seller._id);

        // Include items from active sellers OR admin-added items
        const query = {
            isAvailable: true,
            $or: [{ sellerId: { $in: activeSellerIds } }, { sellerName: "admin" }],
        };

        if (category) {
            query.category = { $regex: category, $options: "i" };
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { productDetails: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
            ];
        }

        const items = await Item.find(query)
            .select(
                "name productDetails  price category imageUrl images videoUrl quantity unit variants sellerId sellerName storeName discount tax hasVAT isAvailable createdAt updatedAt"
            ) // include images, videoUrl
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Item.countDocuments(query);

        res.json({
            success: true,
            items,
            totalPages: Math.ceil(total / limit),
            currentPage: Number.parseInt(page),
            totalItems: total,
        });
    } catch (error) {
        console.error("Get items error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch items",
        });
    }
});

// 2. Update the admin get items endpoint
app.get(
    "/api/admin/items",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { page = 1, limit = 100, category, search } = req.query;

            let query = {};
            if (category && category !== "all") {
                query.category = category;
            }
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { productDetails: { $regex: search, $options: "i" } },
                ];
            }

            const items = await Item.find(query)
                .select(
                    "name productDetails price category imageUrl images videoUrl quantity unit variants sellerId sellerName storeName discount tax hasVAT isAvailable createdAt updatedAt isSpecialItem"
                )
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Item.countDocuments(query);

            res.json({
                success: true,
                items,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            });
        } catch (error) {
            console.error("Get items error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch items",
            });
        }
    }
);

// 3. Update the admin-items public endpoint
app.get("/api/admin-items", async (req, res) => {
    try {
        const {
            category,
            search,
            page = 1,
            limit = 20,
            status = "available",
        } = req.query;

        // Query to find only admin-added items
        const query = {
            sellerName: "admin", // Items added by admin have sellerName as "admin"
        };

        // By default, only show available items for public API
        // You can change this behavior by modifying the default status
        if (status === "available") {
            query.isAvailable = true;
        } else if (status === "hidden") {
            query.isAvailable = false;
        } else if (status === "all") {
            // Don't filter by availability - show all admin items
        } else {
            // Default to available items
            query.isAvailable = true;
        }

        // Filter by category
        if (category) {
            query.category = { $regex: category, $options: "i" };
        }

        // Search functionality
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { productDetails: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
            ];
        }

        const items = await Item.find(query)
            .select(
                "name productDetails  price category imageUrl images videoUrl quantity unit variants sellerId sellerName storeName discount tax hasVAT isAvailable createdAt updatedAt isSpecialItem"
            ) // Added images, videoUrl
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Item.countDocuments(query);

        res.json({
            success: true,
            items,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            totalItems: total,
            message: "Admin items retrieved successfully",
        });
    } catch (error) {
        console.error("Get admin items error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch admin items",
        });
    }
});

// 4. Fix the admin add item endpoint to handle discount, tax, VAT properly
app.post(
    "/api/admin/items/json",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            console.log("JSON Request body:", req.body);

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const {
                name,
                productDetails,
                price,
                category,
                quantity,
                unit,
                imageUrl,
                videoUrl,
                discount = 0,
                tax = 0,
                hasVAT = false,
                isSpecialItem = false,
            } = req.body;

            // Validate required fields. Support either legacy (price+quantity+unit)
            // or new `variants` array in the body (JSON string in multipart).
            let variants = req.body.variants;
            if (typeof variants === "string" && variants.trim()) {
                try {
                    variants = JSON.parse(variants);
                } catch (e) {
                    // leave as string; will fail validation below
                }
            }

            const hasValidVariants = Array.isArray(variants) && variants.length > 0 && variants.every(v => v && v.label && !isNaN(Number(v.price)) && !isNaN(Number(v.quantity)));

            if (!name || !productDetails || !category) {
                return res.status(400).json({ success: false, message: "Name, productDetails and category are required" });
            }

            if (!hasValidVariants) {
                // fallback to legacy fields
                if (!price || !quantity || !unit) {
                    return res.status(400).json({
                        success: false,
                        message: "All required fields must be provided (either provide `variants` or price+quantity+unit)",
                    });
                }
            }

            console.log("Discount, Tax, VAT values:", { discount, tax, hasVAT });

            // Prepare variants (if provided) and derive top-level fields for compatibility
            let parsedVariants = hasValidVariants ? variants.map(v => ({ label: String(v.label).trim(), price: Number(v.price), quantity: Number(v.quantity) })) : [];

            const derivedPrice = parsedVariants.length ? parsedVariants[0].price : (price ? parseFloat(price) : undefined);
            const derivedQuantity = parsedVariants.length ? parsedVariants.reduce((s, vv) => s + Number(vv.quantity), 0) : (quantity ? parseInt(quantity) : undefined);

            // Create item with proper type conversion
            const item = new Item({
                name: name.trim(),
                productDetails: productDetails.trim(),
                price: derivedPrice,
                category: category.trim(),
                imageUrl: imageUrl || "",
                videoUrl: videoUrl || "",
                quantity: derivedQuantity,
                unit: unit ? String(unit).trim() : undefined,
                variants: parsedVariants,
                sellerId: user._id,
                sellerName: user.name,
                storeName: user.storeName || user.name,
                discount: parseFloat(discount) || 0, // Ensure it's a number
                tax: parseFloat(tax) || 0, // Ensure it's a number
                hasVAT: Boolean(hasVAT), // Ensure it's a boolean
                isAvailable: true,
                isSpecialItem: isSpecialItem === "true" || isSpecialItem === true,
            });

            const savedItem = await item.save();
            console.log("Item saved with discount/tax/VAT:", {
                discount: savedItem.discount,
                tax: savedItem.tax,
                hasVAT: savedItem.hasVAT,
                variants: savedItem.variants && savedItem.variants.length,
            });

            res.status(201).json({
                success: true,
                message: "Product added successfully by admin!",
                item: savedItem,
            });
        } catch (error) {
            console.error("Admin add item error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to add product. Please try again.",
                error:
                    process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
    }
);

// 5. Update Get Seller Items to include discount, tax, VAT
app.get("/api/items/my-items", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.userType !== "seller" && user.userType !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only sellers can view their items",
            });
        }

        const items = await Item.find({ sellerId: user._id })
            .select(
                "name productDetails  price category imageUrl quantity unit sellerId sellerName storeName discount tax hasVAT isAvailable createdAt updatedAt isSpecialItem"
            ) // Added discount, tax, hasVAT
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            items,
        });
    } catch (error) {
        console.error("Get seller items error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch your items",
        });
    }
});
// Update Item
app.put("/api/items/:id", authenticateToken, async (req, res) => {
    try {
        const item = await Item.findOne({
            _id: req.params.id,
            sellerId: req.user.id,
        });
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found or you are not authorized to update it",
            });
        }
        const updates = req.body;
        updates.updatedAt = new Date();
        const updatedItem = await Item.findByIdAndUpdate(req.params.id, updates, {
            new: true,
        });
        res.json({
            success: true,
            message: "Item updated successfully!",
            item: updatedItem,
        });
    } catch (error) {
        console.error("Update item error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update item",
        });
    }
});

// Delete Item
app.delete("/api/items/:id", authenticateToken, async (req, res) => {
    try {
        const item = await Item.findOneAndDelete({
            _id: req.params.id,
            sellerId: req.user.id,
        });
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found or you are not authorized to delete it",
            });
        }
        res.json({
            success: true,
            message: "Item deleted successfully!",
        });
    } catch (error) {
        console.error("Delete item error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete item",
        });
    }
});

// Get Categories
app.get("/api/categories", async (req, res) => {
    try {
        const categories = await Item.distinct("category");
        res.json({
            success: true,
            categories,
        });
    } catch (error) {
        console.error("Get categories error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch categories",
        });
    }
});

// =============================================================================
// ORDER MANAGEMENT APIs
// =============================================================================

// Create order
app.post("/api/orders", authenticateToken, async (req, res) => {
    res.setHeader("X-Debug-Hit", "true");
    try {
        const {
            items,
            address,
            paymentMethod,
            paymentId,
            paymentRequestId,
            subtotal,
            shiprocketFee,
            taxAmount,
            totalAmount,
            weight,
            specialRequests,
        } = req.body;

        // Validate required fields
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Order items are required",
            });
        }

        if (!address || !address.name || !address.phone || !address.address) {
            return res.status(400).json({
                success: false,
                message: "Shiprocket address is required",
            });
        }

        if (!paymentMethod || !["cod", "online"].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Valid payment method is required",
            });
        }

        // Generate unique order ID
        const orderId = generateOrderId();

        // Set payment status based on payment method
        let paymentStatus = "pending";
        if (paymentMethod === "cod") {
            paymentStatus = "pending"; // COD remains pending until shiprocket
        } else if (paymentMethod === "online" && paymentId) {
            paymentStatus = "paid";
        }

        // Calculate estimated shiprocket (7 days from now)
        const estimatedShiprocket = new Date();
        estimatedShiprocket.setDate(estimatedShiprocket.getDate() + 7);

        const mappedOrderItems = (items || []).map((it) => ({
            itemId: it.itemId || it.productId || null,
            name: String(it.name || ""),
            price: Number(it.price || 0),
            quantity: Number(it.quantity || 0),
            unit: String(it.unit || ""),                 // always string
            variantLabel: String(it.variantLabel || ""), // always string
            sellerId: it.sellerId || null,
            sellerName: it.sellerName || "",
            tax: Number(it.tax || 0),
            discount: Number(it.discount || 0),
        }));

        const order = new Order({
            userId: req.user.id,
            orderId,
            items: mappedOrderItems,
            address,
            paymentMethod,
            paymentStatus,
            paymentId,
            paymentRequestId,
            subtotal,
            weight: calculateBilledWeight(weight || 0),
            shiprocketFee,
            taxAmount,
            totalAmount,
            convenienceFee: Number(req.body.convenienceFee || 0), // optional for this path
            specialRequests: specialRequests || "",
            orderStatus: "confirmed",
            estimatedShiprocket,
        });



        if (paymentMethod === "cod") {
            const shippingEstimate = await getDelhiveryShippingEstimate(order.address.pincode, order.weight, true);
            order.shiprocketFee = shippingEstimate; // Override with real estimate
            order.totalAmount = subtotal + taxAmount + shippingEstimate; // Recalculate total
        }


        await order.save();

        // Clear user's cart after successful order
        try {
            await Cart.deleteOne({ userId: req.user.id });
        } catch (cartError) {
            console.error("Failed to clear cart after order:", cartError);
            // Don't fail the order if cart clearing fails
        }

        // Send order confirmation email
        // Send order confirmation email only after payment confirmed
        try {
            const user = await User.findById(req.user.id);
            if (order.paymentStatus === "paid") {
                await sendOrderConfirmationEmail(user, order);
            }
        } catch (emailError) {
            console.error("Failed to send order confirmation email:", emailError);
            // Don't fail the order creation if email fails
        }









        // ✅ 1️⃣ Create Shipment in Shiprocket right here
        // Only create shipment for non-local deliveries (COD is confirmed immediately)
        const isLocalDelivery = shouldUseInstamojoForPincode(order.address.pincode);
        if (isLocalDelivery) {
            console.log(`ℹ️ [SKIP SHIPROCKET] Pincode ${order.address.pincode} is in LOCAL NCR region. Shiprocket order creation skipped.`);
        }

        if (!isLocalDelivery && (order.paymentMethod === "cod" || order.paymentStatus === "paid")) {
            console.log(`Creating Shiprocket shipment for order ${order.orderId}, pincode: ${order.address.pincode}`);
            try {
                // Ensure unique SKUs per order to avoid 'SKU cannot be repeated' from Shiprocket
                const skuCountMap = new Map();
                const makeUniqueSku = (base) => {
                    const key = String(base || "SKU-ITEM");
                    const count = (skuCountMap.get(key) || 0) + 1;
                    skuCountMap.set(key, count);
                    return count === 1 ? key : `${key}-${count}`;
                };

                const shiprocketResult = await shiprocket.createShiprocketOrder({
                    orderId: order.orderId,
                    billingCustomerName: order.address.name,
                    billingEmail: req.user.email,
                    billingPhone: order.address.phone,
                    billingAddress: order.address.address,
                    billingCity: order.address.city,
                    billingPincode: order.address.pincode,
                    billingState: order.address.state,
                    paymentMethod: order.paymentMethod === "cod" ? "COD" : "Prepaid",
                    subtotal: order.subtotal,
                    weight: order.weight,
                    shippingCharges: order.shiprocketFee,
                    transactionCharges: (Number(order.convenienceFee || 0) * 1.18),
                    items: order.items.map(item => ({
                        name: item.name,
                        sku: makeUniqueSku(item.itemId || item.name),
                        quantity: item.quantity,
                        price: item.price,
                        tax: item.tax,
                        discount: item.discount
                    }))
                });

                if (shiprocketResult.success) {
                    order.shiprocketOrderId = shiprocketResult.shiprocketOrderId;
                    order.shipmentStatus = "created";
                    order.shiprocketError = null;
                    await order.save();
                    console.log(`Shiprocket order created: ${shiprocketResult.shiprocketOrderId}`);
                } else {
                    order.shiprocketError = shiprocketResult.error;
                    await order.save();
                    console.error("Shiprocket creation failed:", shiprocketResult.error);
                }
            } catch (shipmentError) {
                console.error(`[ORDER ${order.orderId}] Shiprocket API Error:`, shipmentError.message);
            }
        } else if (shouldUseInstamojoForPincode(order.address.pincode)) {
            // Local shiprocket pincode
            order.isLocalShiprocket = true;
            order.shipmentStatus = "na";
            await order.save();
            console.log(`[ORDER ${order.orderId}] Local delivery (Instamojo region) - Shiprocket not required`);
        }















        // Mock addresss


        // try {
        //   const MOCK_DELHIVERY = true;  

        //   let awb = null;
        //   let shipmentDetails = {};

        //   if (MOCK_DELHIVERY) {

        //     awb = `TESTAWB${Date.now()}${Math.floor(Math.random() * 10000)}`;  
        //     shipmentDetails = {
        //       success: true,
        //       upload_wbn: awb,
        //       packages: [{ waybill: awb }],
        //       status: "In Progress",  
        //     };
        //     console.log("✅ MOCK Delhivery Shipment Created:", awb);
        //   } else {

        //     const DELHIVERY_TOKEN = process.env.DELHIVERY_TOKEN || "889a0fe85153498399f843c01b8bda62790a68ac";
        //     const DELHIVERY_URL = "https://track.delhivery.com/api/cmu/create.json";

        //     const shipmentData = {
        //       shipments: [
        //         {
        //           add: order.address.address,
        //           city: order.address.city,
        //           pin: order.address.pincode,
        //           state: order.address.state,
        //           country: "India",
        //           name: order.address.name,
        //           phone: order.address.phone,
        //           order: order.orderId,
        //           payment_mode: order.paymentMethod === "cod" ? "COD" : "Prepaid",
        //           product_details: order.items.map((i) => i.name).join(", "),
        //           cod_amount: order.paymentMethod === "cod" ? order.totalAmount : 0,
        //           weight: 1,
        //           seller_gst_tin: "29ABCDE1234F1Z5",
        //           hsn_code: ["8471"],
        //         },
        //       ],
        //       pickup_location: {
        //         name: "Kanwarji Chandni Chowk", 
        //         add: "CHANDNI, CHOWK",
        //         city: "Delhi",
        //         pin: "110006", 
        //         country: "India",
        //         phone: "+91-9811049585",
        //       },

        //     };

        //     const querystring = require('querystring');
        //     const encodedPayload = querystring.stringify({
        //       format: "json",
        //       data: JSON.stringify(shipmentData),
        //     });

        //     const delhiveryResponse = await axios.post(DELHIVERY_URL, encodedPayload, {
        //       headers: {
        //         Authorization: `Token ${DELHIVERY_TOKEN}`,
        //         "Content-Type": "application/x-www-form-urlencoded",
        //       },
        //     });

        //     console.log("Full Delhivery Response:", JSON.stringify(delhiveryResponse.data, null, 2));

        //     awb = delhiveryResponse.data?.upload_wbn || delhiveryResponse.data?.waybill || null;
        //     shipmentDetails = delhiveryResponse.data;

        //     if (awb && delhiveryResponse.data.success) {
        //       console.log("✅ Delhivery Shipment Created:", awb);
        //     } else {
        //       console.error("❌ No AWB:", delhiveryResponse.data.rmk || "Unknown error");
        //     }
        //   }


        //   if (awb) {
        //     order.awbNumber = awb;
        //     order.orderStatus = "shipped";
        //     order.shipmentStatus = "shipped";
        //     order.shipmentDetails = shipmentDetails;
        //     await order.save();
        //   }
        // } catch (shipmentError) {
        //   console.error("Delhivery shipment error:", shipmentError.response?.data || shipmentError.message);

        // }

























        res.status(201).json({
            success: true,
            message: "Order placed successfully!",
            order_id: order.orderId,
            order: {
                id: order._id,
                orderId: order.orderId,
                totalAmount: order.totalAmount,
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus,
                estimatedShiprocket: order.estimatedShiprocket,
                specialRequests: order.specialRequests, // Include in response
                createdAt: order.createdAt,
            },
        });
    } catch (error) {
        console.error("Create order error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create order",
        });
    }
});

app.get(
    "/api/orders/:orderId/shipment-status",
    authenticateToken,
    async (req, res) => {
        try {
            const order = await Order.findOne({ orderId: req.params.orderId });
            if (!order) return res.status(404).json({ error: "Order not found" });

            if (!order.awbNumber) return res.json({ status: "Not yet shipped" });

            // Use Shiprocket tracking
            const result = await shiprocket.trackShipment(order.awbNumber);

            if (result.success) {
                // Update internal status if available
                const srStatus = result.data?.tracking_data?.shipment_track?.[0]?.current_status;
                if (srStatus && order.shipmentStatus !== srStatus) {
                    order.shipmentStatus = srStatus.toLowerCase();
                    if (srStatus.toLowerCase() === "delivered") order.orderStatus = "delivered";
                    await order.save();
                }
                res.json({
                    orderId: order.orderId,
                    shiprocketOrderId: order.awbNumber,
                    currentStatus: srStatus || "In Transit",
                    details: result.data
                });
            } else {
                res.status(400).json({ error: "Failed to fetch Shiprocket tracking", message: result.error });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

// Admin: Manually create Delhivery shipment for an order
app.post(
    "/api/admin/orders/:orderId/create-delhivery-shipment",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { orderId } = req.params;

            // Find the order
            const order = await Order.findOne({
                $or: [{ orderId }, { _id: orderId }],
            });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            // Check if already has Delhivery shipment
            if (order.awbNumber) {
                return res.status(400).json({
                    success: false,
                    message: "This order already has a Delhivery shipment with AWB: " + order.awbNumber,
                });
            }

            // Skip if local shiprocket
            if (order.isLocalShiprocket) {
                return res.status(400).json({
                    success: false,
                    message: "This is marked as a local shiprocket order",
                });
            }

            // Create shipment in Delhivery One
            const DELHIVERY_TOKEN = process.env.DELHIVERY_TOKEN || "889a0fe85153498399f843c01b8bda62790a68ac";
            const DELHIVERY_ONE_URL = "https://one.delhivery.com/api/shipments/create";

            const shipmentData = {
                shipments: [
                    {
                        waybill: "",
                        consignee: {
                            name: order.address.name,
                            address: order.address.address,
                            address_type: "residential",
                            email: order.user?.email || "customer@example.com",
                            phone: String(order.address.phone).trim(),
                            city: order.address.city,
                            state: order.address.state,
                            postal_code: String(order.address.pincode).trim(),
                            country: "India",
                        },
                        shipper: {
                            name: "Kanwarji",
                            address: "CHANDNI, CHOWK",
                            email: "kanwarji@rpdindia.com",
                            phone: "+91-9811049585",
                            city: "Delhi",
                            state: "Delhi",
                            postal_code: "110006",
                            country: "India",
                        },
                        reference_number: order.orderId,
                        order_date: new Date(order.createdAt).toISOString().split('T')[0],
                        shipment_weight: {
                            value: 1,
                            unit: "kg",
                        },
                        payment_mode: order.paymentMethod === "cod" ? "COD" : "Prepaid",
                        cod_amount: order.paymentMethod === "cod" ? order.totalAmount : 0,
                        declared_value: order.totalAmount,
                        contents_description: order.items.map((i) => i.name).join(", "),
                        service_type: "surface",
                    },
                ],
            };

            const delhiveryResponse = await axios.post(DELHIVERY_ONE_URL, shipmentData, {
                headers: {
                    Authorization: `Token ${DELHIVERY_TOKEN}`,
                    "Content-Type": "application/json",
                },
            });

            // Extract AWB from Delhivery One response
            const awb = delhiveryResponse.data?.shipments?.[0]?.waybill ||
                delhiveryResponse.data?.shipments?.[0]?.waybill_number ||
                delhiveryResponse.data?.shipments?.[0]?.id ||
                null;

            if (awb && (delhiveryResponse.data.success || delhiveryResponse.status === 200 || delhiveryResponse.status === 201)) {
                order.awbNumber = awb;
                order.shipmentStatus = "created";
                order.delhiveryError = "";
                await order.save();

                res.json({
                    success: true,
                    message: "Delhivery One shipment created successfully",
                    data: {
                        orderId: order.orderId,
                        awbNumber: awb,
                        shipmentStatus: order.shipmentStatus,
                    },
                });
            } else {
                const errorMsg = delhiveryResponse.data?.error || delhiveryResponse.data?.message || "Failed to create shipment";
                order.delhiveryError = errorMsg;
                await order.save();

                res.status(400).json({
                    success: false,
                    message: "Failed to create Delhivery One shipment",
                    error: errorMsg,
                });
            }
        } catch (error) {
            console.error("Create Delhivery shipment error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to create Delhivery shipment",
                error: error.message,
            });
        }
    }
);

// Admin: Get orders with failed shipments or refunds
app.get(
    "/api/admin/orders/failed-shipments",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const failedOrders = await Order.find({
                $or: [
                    { delhiveryError: { $exists: true, $ne: "" } },
                    { shipmentStatus: "failed" }
                ]
            })
                .sort({ createdAt: -1 })
                .limit(100);

            const refundPendingOrders = await Order.find({
                paymentMethod: "online",
                paymentStatus: "refunded",
                cancellationInitiatedBy: { $exists: true }
            })
                .sort({ cancelledAt: -1 })
                .limit(100);

            res.json({
                success: true,
                data: {
                    failedShipments: failedOrders,
                    refundsPending: refundPendingOrders,
                    totalFailed: failedOrders.length,
                    totalRefunds: refundPendingOrders.length
                }
            });
        } catch (error) {
            console.error("Get failed orders error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch failed orders"
            });
        }
    }
);

// Admin: Retry refund for a specific cancelled order
app.post(
    "/api/admin/orders/:orderId/retry-refund",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { orderId } = req.params;

            const order = await Order.findOne({
                $or: [{ orderId }, { _id: orderId }]
            });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            if (order.paymentMethod !== "online") {
                return res.status(400).json({
                    success: false,
                    message: "Only online payment orders can have refunds"
                });
            }

            if (order.orderStatus !== "cancelled") {
                return res.status(400).json({
                    success: false,
                    message: "Only cancelled orders can be refunded"
                });
            }

            console.log(`[ADMIN RETRY] Processing refund for order ${order.orderId}`);
            const refundResult = await processInstamojoRefund(order);

            if (refundResult.success || refundResult.skipped) {
                res.json({
                    success: true,
                    message: "Refund processed successfully",
                    refundResult
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: "Refund processing failed",
                    error: refundResult.error
                });
            }
        } catch (error) {
            console.error("Retry refund error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to process refund",
                error: error.message
            });
        }
    }
);

// Admin: Retry Delhivery shipment creation for a specific order
app.post(
    "/api/admin/orders/:orderId/retry-shipment",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { orderId } = req.params;

            const order = await Order.findOne({
                $or: [{ orderId }, { _id: orderId }]
            });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            if (order.isLocalShiprocket) {
                return res.status(400).json({
                    success: false,
                    message: "This is a local shiprocket order - Delhivery not applicable"
                });
            }

            if (order.awbNumber) {
                return res.status(400).json({
                    success: false,
                    message: "Shipment already exists with AWB: " + order.awbNumber
                });
            }

            console.log(`[ADMIN RETRY] Creating Delhivery One shipment for order ${order.orderId}`);

            const DELHIVERY_TOKEN = process.env.DELHIVERY_TOKEN || "889a0fe85153498399f843c01b8bda62790a68ac";
            const DELHIVERY_ONE_URL = "https://one.delhivery.com/api/shipments/create";

            const shipmentData = {
                shipments: [
                    {
                        waybill: "",
                        consignee: {
                            name: order.address.name,
                            address: order.address.address,
                            address_type: "residential",
                            email: order.user?.email || "customer@example.com",
                            phone: String(order.address.phone).trim(),
                            city: order.address.city,
                            state: order.address.state,
                            postal_code: String(order.address.pincode).trim(),
                            country: "India",
                        },
                        shipper: {
                            name: "Kanwarji",
                            address: "CHANDNI, CHOWK",
                            email: "kanwarji@rpdindia.com",
                            phone: "+91-9811049585",
                            city: "Delhi",
                            state: "Delhi",
                            postal_code: "110006",
                            country: "India",
                        },
                        reference_number: order.orderId,
                        order_date: new Date(order.createdAt).toISOString().split('T')[0],
                        shipment_weight: {
                            value: 1,
                            unit: "kg",
                        },
                        payment_mode: order.paymentMethod === "cod" ? "COD" : "Prepaid",
                        cod_amount: order.paymentMethod === "cod" ? order.totalAmount : 0,
                        declared_value: order.totalAmount,
                        contents_description: order.items.map((i) => i.name).join(", "),
                        service_type: "surface",
                    },
                ],
            };

            const delhiveryResponse = await axios.post(DELHIVERY_ONE_URL, shipmentData, {
                headers: {
                    Authorization: `Token ${DELHIVERY_TOKEN}`,
                    "Content-Type": "application/json",
                },
            });

            const awb = delhiveryResponse.data?.shipments?.[0]?.waybill ||
                delhiveryResponse.data?.shipments?.[0]?.waybill_number ||
                delhiveryResponse.data?.shipments?.[0]?.id ||
                null;

            if (awb && (delhiveryResponse.data.success || delhiveryResponse.status === 200 || delhiveryResponse.status === 201)) {
                order.awbNumber = awb;
                order.shipmentStatus = "created";
                order.delhiveryError = "";
                await order.save();

                res.json({
                    success: true,
                    message: "Shipment created successfully",
                    data: {
                        orderId: order.orderId,
                        awbNumber: awb
                    }
                });
            } else {
                const errorMsg = delhiveryResponse.data?.error || delhiveryResponse.data?.message || "Failed to create shipment";
                order.delhiveryError = errorMsg;
                order.shipmentStatus = "failed";
                await order.save();

                res.status(400).json({
                    success: false,
                    message: "Failed to create shipment",
                    error: errorMsg
                });
            }
        } catch (error) {
            console.error("Retry shipment error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to create shipment",
                error: error.message
            });
        }
    }
);
















// Get user orders
app.get("/api/orders", authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const query = {}; // Filter by user ID

        if (status) {
            query.orderStatus = status;
        }

        const orders = await Order.find(query)
            .populate("userId", "name email phone")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: Number.parseInt(page),
            totalOrders: total,
        });
    } catch (error) {
        console.error("Get orders error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
        });
    }
});



















// Get single order
app.get("/api/orders/:orderId", authenticateToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.user.id,
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }
        res.json({
            success: true,
            order,
        });
    } catch (error) {
        console.error("Get order error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch order",
        });
    }
});

// 🚚 Create Delhivery Pickup Request (for domestic deliveries)
async function createDelhiveryPickupRequest(order) {
    try {
        if (shouldUseInstamojoForPincode(order.address.pincode)) {
            console.log(`[ORDER ${order.orderId}] Skipping pickup request for local shiprocket (Instamojo region)`);
            return { success: false, message: "Local shiprocket - pickup not needed", isLocal: true };
        }

        const DELHIVERY_TOKEN = process.env.DELHIVERY_TOKEN || "889a0fe85153498399f843c01b8bda62790a68ac";
        const PICKUP_URL = "https://one.delhivery.com/api/pickup-requests/domestic";

        // Delhivery Pickup Request payload
        const pickupData = {
            pickup_requests: [
                {
                    name: "Kanwarji",
                    email: "kanwarji@rpdindia.com",
                    phone: "+91-9811049585",
                    address: "CHANDNI, CHOWK",
                    city: "Delhi",
                    state: "Delhi",
                    postal_code: "110006",
                    country: "India",
                    expected_package_count: order.items.length,
                    shipment_type: "parcel",
                    pickup_date: new Date().toISOString().split('T')[0],
                    pickup_time_window: {
                        start_time: "09:00",
                        end_time: "17:00"
                    },
                    special_instructions: `Pickup for order ${order.orderId}. ${order.items.length} item(s).`,
                    reference_ids: [order.orderId],
                    waybill_numbers: order.awbNumber ? [order.awbNumber] : []
                }
            ]
        };

        console.log(`[ORDER ${order.orderId}] Creating pickup request with payload:`, JSON.stringify(pickupData.pickup_requests[0], null, 2));

        const response = await axios.post(PICKUP_URL, pickupData, {
            headers: {
                Authorization: `Token ${DELHIVERY_TOKEN}`,
                "Content-Type": "application/json",
            },
        });

        console.log(`[ORDER ${order.orderId}] Pickup request response:`, JSON.stringify(response.data, null, 2));

        if (response.data?.success || response.status === 200 || response.status === 201) {
            const pickupId = response.data?.pickup_requests?.[0]?.id || response.data?.id || Date.now();
            console.log(`✅ [ORDER ${order.orderId}] Pickup request created successfully. ID: ${pickupId}`);
            return {
                success: true,
                pickupId: pickupId,
                status: response.data?.pickup_requests?.[0]?.status || "created",
                message: "Pickup request created"
            };
        } else {
            const errorMsg = response.data?.error || response.data?.message || "Failed to create pickup request";
            console.error(`❌ [ORDER ${order.orderId}] Pickup creation failed:`, errorMsg);
            return {
                success: false,
                message: errorMsg
            };
        }
    } catch (error) {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Pickup API error";
        console.error(`[ORDER ${order.orderId}] Pickup Request API Error:`, errorMsg);
        if (error.response?.status) {
            console.error(`[ORDER ${order.orderId}] HTTP Status: ${error.response.status}`);
        }
        return {
            success: false,
            message: errorMsg,
            error: error.response?.data || error.message
        };
    }
}

// API: Create Pickup Request for a specific order
app.post("/api/orders/:orderId/create-pickup", authenticateToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.user.id,
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Check if shipment was already created
        if (!order.awbNumber) {
            return res.status(400).json({
                success: false,
                message: "Shipment not yet created. Please wait for shipment creation before creating pickup request."
            });
        }

        // Create the pickup request
        const pickupResult = await createDelhiveryPickupRequest(order);

        if (pickupResult.success) {
            // Update order with pickup info
            order.pickupRequestId = pickupResult.pickupId;
            order.pickupStatus = pickupResult.status || "created";
            order.pickupRequestError = "";
            await order.save();

            return res.json({
                success: true,
                message: "Pickup request created successfully",
                pickupId: pickupResult.pickupId,
                status: pickupResult.status
            });
        } else {
            // Save error but don't fail the order
            order.pickupRequestError = pickupResult.message;
            await order.save();

            return res.status(400).json({
                success: false,
                message: pickupResult.message,
                error: pickupResult.error
            });
        }
    } catch (error) {
        console.error("Create pickup error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create pickup request",
            error: error.message
        });
    }
});

// API: Auto-generate pickup request when order is confirmed (optional bulk endpoint)
app.post("/api/orders/generate-pickups/bulk", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { orderIds } = req.body;

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of orderIds"
            });
        }

        const orders = await Order.find({
            orderId: { $in: orderIds }
        });

        const results = [];

        for (const order of orders) {
            // Only generate pickup for orders with shipments
            if (!order.awbNumber) {
                results.push({
                    orderId: order.orderId,
                    success: false,
                    message: "No shipment created yet"
                });
                continue;
            }

            const pickupResult = await createDelhiveryPickupRequest(order);

            if (pickupResult.success) {
                order.pickupRequestId = pickupResult.pickupId;
                order.pickupStatus = pickupResult.status || "created";
                order.pickupRequestError = "";
                await order.save();

                results.push({
                    orderId: order.orderId,
                    success: true,
                    pickupId: pickupResult.pickupId,
                    status: pickupResult.status
                });
            } else {
                order.pickupRequestError = pickupResult.message;
                await order.save();

                results.push({
                    orderId: order.orderId,
                    success: false,
                    message: pickupResult.message
                });
            }
        }

        res.json({
            success: true,
            message: "Pickup request generation complete",
            results: results,
            summary: {
                total: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        });

    } catch (error) {
        console.error("Bulk pickup generation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate pickup requests",
            error: error.message
        });
    }
});

// Send order cancellation email
async function sendOrderCancellationEmail(user, order, cancellationReason) {
    const itemsList = order.items
        .map(
            (item) =>
                `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${item.name}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.quantity}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">₹${item.price}</td>
                </tr>`
        )
        .join("");

    const refundInfo = order.paymentMethod === "online" && order.paymentStatus === "paid"
        ? `
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
              <h3 style="margin: 0 0 12px 0; color: #856404; font-size: 16px;">Refund Information</h3>
              <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your payment of <strong>₹${order.totalAmount}</strong> will be refunded to your original payment method.</p>
              <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Refund processing typically takes 3-5 business days.</p>
            </div>
          `
        : ``;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `Order Cancelled - ${order.orderId}`,
        html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f9f9f9;">
        <!-- Cancellation Banner -->
        <div style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); padding: 30px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">✗</div>
          <h2 style="margin: 0; font-size: 28px; font-weight: bold;">Order Cancelled</h2>
        </div>

        <!-- Main Content -->
        <div style="padding: 30px; background-color: white;">
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Hello <strong>${user.name}</strong>,</p>
          <p style="margin: 0 0 25px 0; font-size: 14px; color: #666; line-height: 1.6;">Your order has been successfully cancelled. Here are the details:</p>

          <!-- Cancellation Details -->
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f44336;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Cancellation Details</h3>
            <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Order ID:</strong> ${order.orderId}</p>
          <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Cancellation Date & Time:</strong> ${formatIST(order.cancelledAt || order.updatedAt || order.createdAt)}</p>
            ${cancellationReason ? `<p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Reason:</strong> ${cancellationReason}</p>` : ""}
          </div>

          <!-- Order Summary -->
          <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Order Summary</h3>
          <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 12px; text-align: left; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Item</th>
                <th style="padding: 12px; text-align: center; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 12px; text-align: right; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>

          <!-- Cost Breakdown -->
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
  <p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;">
    <span>Subtotal:</span> <strong>₹${Number(order.subtotal || 0).toFixed(2)}</strong>
  </p>
  ${order.taxAmount ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Tax:</span> <strong>₹${Number(order.taxAmount || 0).toFixed(2)}</strong></p>` : ""}
  ${order.shiprocketFee ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Shiprocket Fee:</span> <strong>₹${Number(order.shiprocketFee || 0).toFixed(2)}</strong></p>` : ""}
 ${order.convenienceFee ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Convenience Fee:</span> <strong>₹${(Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</strong></p>` : ""}
  <p style="margin: 12px 0 0 0; padding-top: 12px; border-top: 2px solid #ddd; color: #333; font-size: 16px; display: flex; justify-content: space-between;">
    <span><strong>Total:</strong></span> <strong style="color: #d32f2f;">₹${(Number(order.totalAmount || 0) + Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</strong>
  </p>
</div>

          <!-- Refund Information -->
          ${refundInfo}

          <!-- Next Steps -->
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #1565c0; font-size: 16px;">What Happens Next?</h3>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your order has been removed from processing</p>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ No shipment will be sent for this order</p>
            ${order.paymentMethod === "online" && order.paymentStatus === "paid" ? `<p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your refund will be processed within 3-5 business days</p>` : ""}
          </div>

          <!-- Support -->
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.6;">
            If you have any questions about your cancellation, please don't hesitate to <strong>contact us</strong>. We're here to help!
          </p>

          <p style="margin: 0; font-size: 14px; color: #999;">We hope to serve you again in the future.</p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0; font-size: 12px; color: #999;">
            This is an automated email. Please do not reply directly to this email.<br>
            For support, visit our website or contact us at kanwarji@rpdindia.com
          </p>
        </div>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);
}

// Request order cancellation - Creates a request that admin must approve/reject
app.post(
    "/api/orders/:orderId/request-cancellation",
    authenticateToken,
    async (req, res) => {
        try {
            const { reason } = req.body;
            const orderId = req.params.orderId;

            if (!reason || reason.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Cancellation reason is required",
                });
            }

            // Try to find by orderId or MongoDB _id
            let order = await Order.findOne({
                orderId: orderId,
                userId: req.user.id,
            });

            if (!order) {
                order = await Order.findOne({
                    _id: orderId,
                    userId: req.user.id,
                });
            }

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            // Check if order can be cancelled (only pending, confirmed, and processing orders can be cancelled)
            const cancelleableStatuses = ["pending", "confirmed", "processing"];
            if (!cancelleableStatuses.includes(order.orderStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Order with status '${order.orderStatus}' cannot be cancelled. Only pending, confirmed, or processing orders can be cancelled.`,
                });
            }

            // Check if there's already a pending cancellation request
            const existingRequest = await CancellationRequest.findOne({
                orderId: order._id,
                status: "pending"
            });

            if (existingRequest) {
                return res.status(400).json({
                    success: false,
                    message: "A cancellation request for this order is already pending admin review",
                });
            }

            // Get user details
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            // Create cancellation request
            const cancellationRequest = new CancellationRequest({
                orderId: order._id,
                userId: req.user.id,
                orderIdStr: order.orderId,
                customerName: user.name || "Not provided",
                customerEmail: user.email,
                customerPhone: user.phone || "Not provided",
                cancellationReason: reason,
                status: "pending",
                totalAmount: order.totalAmount,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                paymentId: order.paymentId || "",
                items: order.items || [],
                // Prefer the standard `address` saved on the order, fall back to shiprocketAddress
                address: order.address || order.shiprocketAddress || {},
            });

            await cancellationRequest.save();

            // Update order status to mark it as having a pending cancellation request
            order.orderStatus = "cancellation-pending";
            order.updatedAt = new Date();
            await order.save();

            // Send confirmation email to user
            try {
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: `Cancellation Request Received - Order #${order.orderId}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                            <div style="background-color: #fff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #333; text-align: center;">Cancellation Request Received</h2>
                                <p style="color: #666; font-size: 14px;">Hi ${user.name},</p>
                                <p style="color: #666; font-size: 14px;">We have received your cancellation request for order <strong>#${order.orderId}</strong>.</p>
                                
                                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                                    <p style="margin: 0; color: #856404; font-size: 14px;"><strong>⏳ Status: Under Review</strong></p>
                                    <p style="margin: 8px 0; color: #856404; font-size: 14px;">Your request is now being reviewed by our admin team. You will receive an email notification once it's approved or rejected.</p>
                                </div>

                                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <p style="margin: 0; color: #666; font-size: 14px;"><strong>Order Details:</strong></p>
                                    <p style="margin: 8px 0; color: #666; font-size: 14px;">Order ID: ${order.orderId}</p>
                                    <p style="margin: 8px 0; color: #666; font-size: 14px;">Order Total: ₹${order.totalAmount.toFixed(2)}</p>
                                    <p style="margin: 8px 0; color: #666; font-size: 14px;">Cancellation Reason: ${reason}</p>
                                </div>

                                ${order.paymentMethod === "online" && order.paymentStatus === "paid" ? `
                                    <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid green;">
                                        <p style="margin: 0; color: #2e7d32; font-size: 14px;"><strong>Refund Information:</strong></p>
                                        <p style="margin: 8px 0; color: #2e7d32; font-size: 14px;">If your cancellation is approved, your refund of ₹${order.totalAmount.toFixed(2)} will be processed to your original payment method within 3-5 business days.</p>
                                    </div>
                                ` : ""}

                                <p style="color: #666; font-size: 14px; margin-top: 20px;">Thank you for your patience. We appreciate your business.</p>
                                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">This is an automated email. Please do not reply directly.</p>
                            </div>
                        </div>
                    `,
                };
                await transporter.sendMail(mailOptions);
            } catch (emailError) {
                console.error("Failed to send cancellation request confirmation email:", emailError);
            }

            res.json({
                success: true,
                message: "Cancellation request submitted successfully. Our admin team will review it shortly.",
                orderId: order.orderId,
                orderStatus: "cancellation-pending",
                requestId: cancellationRequest._id,
            });
        } catch (error) {
            console.error("Request cancellation error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to submit cancellation request",
            });
        }
    }
);

// Cancel order - Immediately cancels and processes refunds
app.patch(
    "/api/orders/:orderId/cancel",
    authenticateToken,
    async (req, res) => {
        try {
            const { reason } = req.body;
            const orderId = req.params.orderId;

            // Try to find by orderId or MongoDB _id
            let order = await Order.findOne({
                orderId: orderId,
                userId: req.user.id,
            });

            if (!order) {
                order = await Order.findOne({
                    _id: orderId,
                    userId: req.user.id,
                });
            }

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            // Check if order can be cancelled (only pending, confirmed, and processing orders can be cancelled)
            const cancelleableStatuses = ["pending", "confirmed", "processing"];
            if (!cancelleableStatuses.includes(order.orderStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Order with status '${order.orderStatus}' cannot be cancelled. Only pending, confirmed, or processing orders can be cancelled.`,
                });
            }

            // Check if order is already cancelled
            if (order.orderStatus === "cancelled") {
                return res.status(400).json({
                    success: false,
                    message: "This order is already cancelled",
                });
            }

            // Immediately cancel the order
            order.orderStatus = "cancelled";
            order.cancelledAt = new Date();
            order.cancellationReason = reason || "Cancelled by user";
            order.cancellationInitiatedBy = "user";
            order.updatedAt = new Date();

            // Process refund if payment was made online
            let refundResult = null;
            if (order.paymentMethod === "online" && order.paymentStatus === "paid") {
                order.paymentStatus = "refunded";
                order.refundedAt = new Date();
                console.log(`Processing Instamojo refund for user-cancelled order ${order.orderId}`);
                refundResult = await processInstamojoRefund(order);

                if (!refundResult.success && !refundResult.skipped) {
                    console.error(`Refund processing warning: ${refundResult.error}`);
                    // Still save the cancellation even if refund processing has issues
                }
            }

            await order.save();

            // Send cancellation email to user
            try {
                const user = await User.findById(req.user.id);
                if (user) {
                    await sendOrderCancellationEmail(user, order, reason);
                }
            } catch (emailError) {
                console.error("Failed to send cancellation email:", emailError);
                // Don't fail the operation if email fails
            }

            res.json({
                success: true,
                message: "Order cancelled successfully. Refund will be processed within 5-7 business days.",
                orderId: order.orderId,
                orderStatus: order.orderStatus,
                cancelledAt: order.cancelledAt,
                refundInfo: refundResult ? {
                    status: refundResult.success ? "processed" : "pending",
                    message: refundResult.success
                        ? "Refund request submitted to payment gateway"
                        : "Refund will be processed manually"
                } : null
            });
        } catch (error) {
            console.error("Cancel order error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to cancel order",
            });
        }
    }
);

// =============================================================================
// USER CANCELLATION REQUEST APIs
// =============================================================================

// Get user's cancellation requests
app.get(
    "/api/user/cancellation-requests",
    authenticateToken,
    async (req, res) => {
        try {
            const { status = "all", page = 1, limit = 10 } = req.query;

            const query = { userId: req.user.id };

            // Filter by status
            if (status && status !== "all") {
                query.status = status;
            }

            const requests = await CancellationRequest.find(query)
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await CancellationRequest.countDocuments(query);

            res.json({
                success: true,
                data: {
                    requests,
                    totalPages: Math.ceil(total / limit),
                    currentPage: Number.parseInt(page),
                    totalRequests: total,
                },
            });
        } catch (error) {
            console.error("Get user cancellation requests error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch cancellation requests",
            });
        }
    }
);

// Get single user's cancellation request details
app.get(
    "/api/user/cancellation-requests/:id",
    authenticateToken,
    async (req, res) => {
        try {
            const request = await CancellationRequest.findOne({
                _id: req.params.id,
                userId: req.user.id,
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: "Cancellation request not found",
                });
            }

            res.json({
                success: true,
                data: request,
            });
        } catch (error) {
            console.error("Get user cancellation request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch cancellation request",
            });
        }
    }
);

// =============================================================================
// CANCELLATION REQUEST MANAGEMENT APIs (ADMIN)
// =============================================================================

// Get all cancellation requests
app.get(
    "/api/admin/cancellation-requests",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { status = "pending", page = 1, limit = 50, search } = req.query;

            const query = {};

            // Filter by status
            if (status && status !== "all") {
                query.status = status;
            }

            // Search functionality
            if (search) {
                query.$or = [
                    { orderIdStr: { $regex: search, $options: "i" } },
                    { customerName: { $regex: search, $options: "i" } },
                    { customerEmail: { $regex: search, $options: "i" } },
                    { customerPhone: { $regex: search, $options: "i" } },
                ];
            }

            const requests = await CancellationRequest.find(query)
                .populate("userId", "name email")
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await CancellationRequest.countDocuments(query);

            res.json({
                success: true,
                data: {
                    requests,
                    totalPages: Math.ceil(total / limit),
                    currentPage: Number.parseInt(page),
                    totalRequests: total,
                },
            });
        } catch (error) {
            console.error("Get cancellation requests error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch cancellation requests",
            });
        }
    }
);

// Get single cancellation request details
app.get(
    "/api/admin/cancellation-requests/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const request = await CancellationRequest.findById(req.params.id)
                .populate("userId", "name email phone")
                .populate("processedBy", "name email");

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: "Cancellation request not found",
                });
            }

            res.json({
                success: true,
                data: request,
            });
        } catch (error) {
            console.error("Get cancellation request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch cancellation request",
            });
        }
    }
);

// Approve cancellation request
app.patch(
    "/api/admin/cancellation-requests/:id/approve",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { adminRemarks } = req.body;
            const requestId = req.params.id;

            const cancellationRequest = await CancellationRequest.findById(requestId);

            if (!cancellationRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Cancellation request not found",
                });
            }

            if (cancellationRequest.status !== "pending") {
                return res.status(400).json({
                    success: false,
                    message: "Only pending cancellation requests can be approved",
                });
            }

            // Update cancellation request
            cancellationRequest.status = "approved";
            cancellationRequest.adminRemarks = adminRemarks || "";
            cancellationRequest.processedBy = req.user.id;
            cancellationRequest.processedAt = new Date();
            await cancellationRequest.save();

            // Update order status
            const order = await Order.findById(cancellationRequest.orderId);
            if (order) {
                order.orderStatus = "cancelled";
                order.cancelledAt = new Date();
                order.cancellationReason = cancellationRequest.cancellationReason;
                order.updatedAt = new Date();

                // If payment was made online and already paid, mark for refund
                if (order.paymentMethod === "online" && order.paymentStatus === "paid") {
                    order.paymentStatus = "refunded";
                }

                await order.save();

                // ✅ Cancel order in Shiprocket if applicable
                if ((order.shiprocketOrderId || order.awbNumber) && !order.isLocalShiprocket) {
                    try {
                        const srId = order.shiprocketOrderId || order.awbNumber;
                        console.log(`[SHIPROCKET] Cancelling shipment for approved request: ${srId}`);
                        const srResult = await shiprocket.cancelShiprocketOrder(srId);
                        if (srResult.success) {
                            console.log(`✅ [SHIPROCKET] Order ${srId} cancelled successfully`);
                        } else {
                            console.error(`❌ [SHIPROCKET] Cancellation failed: ${srResult.error}`);
                        }
                    } catch (srError) {
                        console.error(`[SHIPROCKET] Cancellation error:`, srError.message);
                    }
                }

                // Send approval email
                try {
                    const user = await User.findById(cancellationRequest.userId);
                    if (user) {
                        const mailOptions = {
                            from: process.env.EMAIL_USER,
                            to: user.email,
                            subject: `Order Cancellation Approved - ${cancellationRequest.orderIdStr}`,
                            html: `
                                <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                                    <div style="background-color: #fff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                                        <h2 style="color: #333; text-align: center;">Order Cancellation Approved</h2>
                                        <p style="color: #666; font-size: 14px;">Hi ${user.name},</p>
                                        <p style="color: #666; font-size: 14px;">Your cancellation request for order <strong>#${cancellationRequest.orderIdStr}</strong> has been <strong style="color: green;">APPROVED</strong>.</p>
                                        
                                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Order Details:</strong></p>
                                            <p style="margin: 8px 0; color: #666; font-size: 14px;">Order ID: ${cancellationRequest.orderIdStr}</p>
                                            <p style="margin: 8px 0; color: #666; font-size: 14px;">Order Total: ₹${cancellationRequest.totalAmount.toFixed(2)}</p>
                                            <p style="margin: 8px 0; color: #666; font-size: 14px;">Cancellation Reason: ${cancellationRequest.cancellationReason}</p>
                                            ${adminRemarks ? `<p style="margin: 8px 0; color: #666; font-size: 14px;">Admin Notes: ${adminRemarks}</p>` : ""}
                                        </div>

                                        ${order.paymentMethod === "online" && order.paymentStatus === "refunded" ? `
                                            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid green;">
                                                <p style="margin: 0; color: #2e7d32; font-size: 14px;"><strong>Refund Information:</strong></p>
                                                <p style="margin: 8px 0; color: #2e7d32; font-size: 14px;">Your refund of ₹${cancellationRequest.totalAmount.toFixed(2)} has been initiated.</p>
                                                <p style="margin: 8px 0; color: #2e7d32; font-size: 14px;">It will be processed to your original payment method within 3-5 business days.</p>
                                            </div>
                                        ` : ""}

                                        <p style="color: #666; font-size: 14px; margin-top: 20px;">Thank you for your business. If you have any questions, please contact us.</p>
                                        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">This is an automated email. Please do not reply directly.</p>
                                    </div>
                                </div>
                            `,
                        };
                        await transporter.sendMail(mailOptions);
                    }
                } catch (emailError) {
                    console.error("Failed to send approval email:", emailError);
                }
            }

            res.json({
                success: true,
                message: "Cancellation request approved successfully",
                data: cancellationRequest,
            });
        } catch (error) {
            console.error("Approve cancellation request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to approve cancellation request",
            });
        }
    }
);

// Reject cancellation request
app.patch(
    "/api/admin/cancellation-requests/:id/reject",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { adminRemarks, adminResponse } = req.body;
            const requestId = req.params.id;

            const cancellationRequest = await CancellationRequest.findById(requestId);

            if (!cancellationRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Cancellation request not found",
                });
            }

            if (cancellationRequest.status !== "pending") {
                return res.status(400).json({
                    success: false,
                    message: "Only pending cancellation requests can be rejected",
                });
            }

            // Update cancellation request
            cancellationRequest.status = "rejected";
            cancellationRequest.adminRemarks = adminRemarks || "";
            cancellationRequest.adminResponse = adminResponse || "Your cancellation request has been rejected";
            cancellationRequest.processedBy = req.user.id;
            cancellationRequest.processedAt = new Date();
            await cancellationRequest.save();

            // Restore order status back to confirmed since cancellation was rejected
            const order = await Order.findById(cancellationRequest.orderId);
            if (order) {
                order.orderStatus = "confirmed";
                order.updatedAt = new Date();
                await order.save();
            }

            // Send rejection email
            try {
                const user = await User.findById(cancellationRequest.userId);
                if (user) {
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: user.email,
                        subject: `Order Cancellation Request - ${cancellationRequest.orderIdStr}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                                <div style="background-color: #fff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                                    <h2 style="color: #333; text-align: center;">Cancellation Request Status</h2>
                                    <p style="color: #666; font-size: 14px;">Hi ${user.name},</p>
                                    <p style="color: #666; font-size: 14px;">Your cancellation request for order <strong>#${cancellationRequest.orderIdStr}</strong> has been <strong style="color: #d32f2f;">DECLINED</strong>.</p>
                                    
                                    <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #d32f2f;">
                                        <p style="margin: 0; color: #c62828; font-size: 14px;"><strong>Reason:</strong></p>
                                        <p style="margin: 8px 0; color: #c62828; font-size: 14px;">${adminResponse || "Your cancellation request cannot be processed at this time."}</p>
                                        ${adminRemarks ? `<p style="margin: 8px 0; color: #c62828; font-size: 14px;"><strong>Admin Notes:</strong> ${adminRemarks}</p>` : ""}
                                    </div>

                                    <p style="color: #666; font-size: 14px; margin-top: 20px;">Your order <strong>#${cancellationRequest.orderIdStr}</strong> remains active. If you have any questions, please contact our support team.</p>
                                    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">This is an automated email. Please do not reply directly.</p>
                                </div>
                            </div>
                        `,
                    };
                    await transporter.sendMail(mailOptions);
                }
            } catch (emailError) {
                console.error("Failed to send rejection email:", emailError);
            }

            res.json({
                success: true,
                message: "Cancellation request rejected successfully",
                data: cancellationRequest,
            });
        } catch (error) {
            console.error("Reject cancellation request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to reject cancellation request",
            });
        }
    }
);

// =============================================================================
// RAZORPAY & PAYMENT APIs - UNCOMMENTED
// =============================================================================

// Create Razorpay order
app.post("/api/create-razorpay-order", authenticateToken, async (req, res) => {
    try {
        const { amount, currency = "INR" } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid amount is required",
            });
        }
        const options = {
            amount: Math.round(amount), // Amount in paise
            currency,
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1,
        };
        if (!razorpay) {
            return res.status(503).json({
                success: false,
                message: "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
            });
        }
        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt,
        });
    } catch (error) {
        console.error("Create Razorpay order error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create payment order",
        });
    }
});

// Verify Razorpay payment
app.post(
    "/api/verify-razorpay-payment",
    authenticateToken,
    async (req, res) => {
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
                req.body;
            const sign = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSign = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(sign.toString())
                .digest("hex");
            if (razorpay_signature === expectedSign) {
                res.json({
                    success: true,
                    message: "Payment verified successfully",
                    paymentId: razorpay_payment_id,
                    orderId: razorpay_order_id,
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: "Invalid payment signature",
                });
            }
        } catch (error) {
            console.error("Verify payment error:", error);
            res.status(500).json({
                success: false,
                message: "Payment verification failed",
            });
        }
    }
);
// =============================================================================
// GOOGLE & FACEBOOK OAUTH ROUTES
// =============================================================================
// Google OAuth Login
app.post("/api/auth/google", async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken)
            return res
                .status(400)
                .json({ success: false, message: "No idToken provided" });

        // Verify token
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        // Find or create user
        let user = await User.findOne({ email });
        if (!user) {
            user = new User({
                name,
                email,
                phone: "", // You may want to ask for phone later
                password: "", // Not needed for OAuth
                userType: "buyer",
                isVerified: true,
                profileImage: picture,
            });
            await user.save();
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || "your-secret-key",
            {
                expiresIn: "7d",
            }
        );

        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            isActive: user.isActive,
            createdAt: user.createdAt,
        };

        res.json({
            success: true,
            message: "Google login successful!",
            user: userData,
            token,
        });
    } catch (error) {
        console.error("Google OAuth error:", error);
        res.status(500).json({ success: false, message: "Google login failed" });
    }
});

// Facebook OAuth Login
app.post("/api/auth/facebook", async (req, res) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken)
            return res
                .status(400)
                .json({ success: false, message: "No accessToken provided" });

        // Verify token and get user info
        const fbRes = await fetch(
            `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
        );
        const fbData = await fbRes.json();
        if (!fbData.email) {
            return res
                .status(400)
                .json({ success: false, message: "Facebook account has no email" });
        }

        // Find or create user
        let user = await User.findOne({ email: fbData.email });
        if (!user) {
            user = new User({
                name: fbData.name,
                email: fbData.email,
                phone: "", // You may want to ask for phone later
                password: "", // Not needed for OAuth
                userType: "buyer",
                isVerified: true,
                profileImage: fbData.picture?.data?.url,
            });
            await user.save();
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || "your-secret-key",
            {
                expiresIn: "7d",
            }
        );

        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            isActive: user.isActive,
            createdAt: user.createdAt,
        };

        res.json({
            success: true,
            message: "Facebook login successful!",
            user: userData,
            token,
        });
    } catch (error) {
        console.error("Facebook OAuth error:", error);
        res.status(500).json({ success: false, message: "Facebook login failed" });
    }
});

// Health check endpoint
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
// Get all orders for admin
app.get(
    "/api/admin/orders",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { page = 1, limit = 50, status, search } = req.query;

            const query = {};

            // Filter by status if provided
            if (status && status !== "all") {
                query.orderStatus = status;
            }

            // Search functionality
            if (search) {
                query.$or = [
                    { orderId: { $regex: search, $options: "i" } },
                    { "userId.name": { $regex: search, $options: "i" } },
                    { "userId.email": { $regex: search, $options: "i" } },
                ];
            }

            const orders = await Order.find(query)
                .populate("userId", "name email phone")
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Order.countDocuments(query);

            res.json({
                success: true,
                data: {
                    orders,
                    totalPages: Math.ceil(total / limit),
                    currentPage: Number.parseInt(page),
                    totalOrders: total,
                },
            });
        } catch (error) {
            console.error("Get admin orders error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch orders",
            });
        }
    }
);
// Admin: Update payment status and send confirmation email on transition to paid
app.patch(
    "/api/admin/orders/:id/payment",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { paymentStatus } = req.body || {};

            if (!paymentStatus || !["pending", "paid", "failed", "refunded"].includes(paymentStatus)) {
                return res.status(400).json({ success: false, message: "Invalid paymentStatus" });
            }

            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            const prevPaymentStatus = order.paymentStatus;
            order.paymentStatus = paymentStatus;
            if (paymentStatus === "paid" && order.orderStatus === "pending") {
                order.orderStatus = "confirmed";
            }
            order.updatedAt = new Date();
            await order.save();

            // Send confirmation email only on transition to paid
            if (prevPaymentStatus !== "paid" && order.paymentStatus === "paid") {
                try {
                    const user = await User.findById(order.userId);
                    if (user) await sendOrderConfirmationEmail(user, order);
                } catch (e) {
                    console.error("Admin payment-status email failed:", e?.message || e);
                }
            }

            return res.json({ success: true, order });
        } catch (error) {
            console.error("Admin update payment status error:", error);
            return res.status(500).json({ success: false, message: "Failed to update payment status" });
        }
    }
);

// Admin: Cancel Order
app.patch(
    "/api/admin/orders/:id/cancel",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason, remarks } = req.body || {};

            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            // Check if order can be cancelled
            if (order.orderStatus === "cancelled") {
                return res.status(400).json({
                    success: false,
                    message: "This order is already cancelled"
                });
            }

            if (order.orderStatus === "delivered") {
                return res.status(400).json({
                    success: false,
                    message: "Cannot cancel delivered orders"
                });
            }

            // Update order for admin cancellation
            order.orderStatus = "cancelled";
            order.cancelledAt = new Date();
            order.cancellationReason = reason || "Cancelled by admin";
            order.cancellationInitiatedBy = "admin";
            order.adminRemarks = remarks || "";
            order.updatedAt = new Date();

            // If payment was made online, process refund via Instamojo
            let refundResult = null;
            if (order.paymentMethod === "online" && order.paymentStatus === "paid") {
                order.paymentStatus = "refunded";
                console.log(`Processing refund for order ${order.orderId}`);
                refundResult = await processInstamojoRefund(order);

                if (!refundResult.success && !refundResult.skipped) {
                    console.error(`Refund processing failed: ${refundResult.error}`);
                }
                order.refundedAt = new Date();
            }

            await order.save();

            // ✅ Cancel order in Shiprocket if applicable
            if ((order.shiprocketOrderId || order.awbNumber) && !order.isLocalShiprocket) {
                try {
                    const srId = order.shiprocketOrderId || order.awbNumber;
                    console.log(`[SHIPROCKET] Admin cancelling shipment for order ${order.orderId}, ID: ${srId}`);
                    const srResult = await shiprocket.cancelShiprocketOrder(srId);
                    if (srResult.success) {
                        console.log(`✅ [SHIPROCKET] Order ${srId} cancelled successfully`);
                    } else {
                        console.error(`❌ [SHIPROCKET] Cancellation failed: ${srResult.error}`);
                    }
                } catch (srError) {
                    console.error(`[SHIPROCKET] Cancellation error:`, srError.message);
                }
            }

            // Send cancellation email to user
            try {
                const user = await User.findById(order.userId);
                if (user) {
                    await sendOrderCancellationEmail(user, order, reason);
                }
            } catch (emailError) {
                console.error("Failed to send admin cancellation email:", emailError);
                // Don't fail the operation if email fails
            }

            return res.json({
                success: true,
                message: "Order cancelled successfully by admin",
                order: {
                    orderId: order.orderId,
                    orderStatus: order.orderStatus,
                    cancelledAt: order.cancelledAt,
                    cancellationReason: order.cancellationReason,
                    adminRemarks: order.adminRemarks
                }
            });
        } catch (error) {
            console.error("Admin cancel order error:", error);
            return res.status(500).json({ success: false, message: "Failed to cancel order" });
        }
    }
);

// Get all users for admin
app.get(
    "/api/admin/users",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { page = 1, limit = 100, userType, search } = req.query;

            const query = {};

            // Filter by user type if provided
            if (userType && userType !== "all") {
                query.userType = userType;
            }

            // Search functionality
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                ];
            }

            const users = await User.find(query)
                .select("-password") // Exclude password field
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await User.countDocuments(query);

            res.json({
                success: true,
                users,
                totalPages: Math.ceil(total / limit),
                currentPage: Number.parseInt(page),
                totalUsers: total,
            });
        } catch (error) {
            console.error("Get admin users error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch users",
            });
        }
    }
);

app.post("/api/items", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        // Allow both sellers and admins to add items
        if (!user || (user.userType !== "seller" && user.userType !== "admin")) {
            return res.status(403).json({
                success: false,
                message: "Only approved sellers and admins can add items",
            });
        }

        // For sellers, check if they are active
        if (user.userType === "seller" && !user.isActive) {
            return res.status(403).json({
                success: false,
                message:
                    "Your seller account is currently deactivated. Please contact admin.",
            });
        }

        const { name, productDetails, price, category, imageUrl, quantity, unit } =
            req.body;

        const item = new Item({
            name,
            productDetails,
            price,
            category,
            imageUrl,
            quantity,
            unit,
            sellerId: user._id,
            sellerName: user.name,
            storeName: user.storeName || user.name,
        });

        await item.save();

        res.status(201).json({
            success: true,
            message: "Item added successfully!",
            item,
        });
    } catch (error) {
        console.error("Add item error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add item. Please try again.",
        });
    }
});

app.patch(
    "/api/admin/items/:itemId/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { itemId } = req.params;
            const { isAvailable } = req.body;

            const item = await Item.findByIdAndUpdate(
                itemId,
                { isAvailable },
                { new: true }
            );

            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: "Item not found",
                });
            }

            res.json({
                success: true,
                message: `Item ${isAvailable ? "made available" : "hidden"
                    } successfully`,
                item,
            });
        } catch (error) {
            console.error("Toggle item status error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update item status",
            });
        }
    }
);

app.get(
    "/api/admin/orders/:orderId/invoice/download",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { orderId } = req.params;

            const order = await Order.findOne({ orderId }).populate(
                "userId",
                "name email phone"
            );

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            // Generate PDF
            const pdfBuffer = await generateInvoicePDF(order);

            // Set headers for PDF download
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="invoice_${orderId}.pdf"`
            );
            res.setHeader("Content-Length", pdfBuffer.length);

            // Send PDF buffer
            res.send(pdfBuffer);
        } catch (error) {
            console.error("Download invoice error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to generate invoice",
            });
        }
    }
);

// Get Invoice Data (for mobile app PDF generation)
app.get(
    "/api/admin/orders/:orderId/invoice/data",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { orderId } = req.params;

            const order = await Order.findOne({ orderId }).populate(
                "userId",
                "name email phone"
            );

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            // Return structured invoice data
            const invoiceData = {
                // Company Details
                company: {
                    name: "Your Company Name",
                    address: "123 Business Street",
                    city: "Business City, State 12345",
                    phone: "+1 (555) 123-4567",
                    email: "info@yourcompany.com",
                    website: "www.yourcompany.com",
                },

                // Invoice Details
                invoice: {
                    number: orderId,
                    date: order.createdAt,
                    dueDate: order.estimatedShiprocket,
                },

                // Customer Details
                customer: {
                    name: order.userId.name,
                    email: order.userId.email,
                    phone: order.userId.phone,
                    address: {
                        name: order.address.name,
                        phone: order.address.phone,
                        address: order.address.address,
                        city: order.address.city,
                        state: order.address.state,
                        pincode: order.address.pincode,
                    },
                },

                // Order Details
                order: {
                    id: order._id,
                    orderId: order.orderId,
                    // Ensure each item has variantLabel/unit keys if they already exist on the document
                    items: (order.items || []).map((it) => ({
                        ...(it?.toObject ? it.toObject() : it),
                        variantLabel: it?.variantLabel || it?.unit || "",  // will drive UI display
                        unit: it?.unit || it?.variantLabel || "",
                    })),
                    subtotal: order.subtotal,
                    shiprocketFee: order.shiprocketFee,
                    taxAmount: order.taxAmount,
                    convenienceFee: Number(order.convenienceFee || 0),    // allow the UI to show and add it
                    totalAmount: order.totalAmount,
                    paymentMethod: order.paymentMethod,
                    paymentStatus: order.paymentStatus,
                    orderStatus: order.orderStatus,
                    createdAt: order.createdAt,
                    estimatedShiprocket: order.estimatedShiprocket,
                },
            };

            res.json({
                success: true,
                invoiceData,
            });
        } catch (error) {
            console.error("Get invoice data error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch invoice data",
            });
        }
    }
);
app.get(
    "/api/admin/users/:userId",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId).select("-password");
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            // Get user's order statistics
            const totalOrders = await Order.countDocuments({ userId });
            const completedOrders = await Order.countDocuments({
                userId,
                orderStatus: "delivered",
            });

            const totalSpentResult = await Order.aggregate([
                { $match: { userId: mongoose.Types.ObjectId(userId) } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]);

            const totalSpent =
                totalSpentResult.length > 0 ? totalSpentResult[0].total : 0;

            const userDetails = {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                userType: user.userType,
                isActive: user.isActive,
                isVerified: user.isVerified,
                createdAt: user.createdAt,
                totalOrders,
                completedOrders,
                totalSpent,
            };

            res.json({
                success: true,
                user: userDetails,
            });
        } catch (error) {
            console.error("Get user details error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch user details",
            });
        }
    }
);

// Get User Order History (for View Customer feature)
app.get(
    "/api/admin/users/:userId/orders",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const orders = await Order.find({ userId })
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalOrders = await Order.countDocuments({ userId });

            res.json({
                success: true,
                orders,
                totalPages: Math.ceil(totalOrders / limit),
                currentPage: parseInt(page),
                totalOrders,
            });
        } catch (error) {
            console.error("Get user orders error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch user orders",
            });
        }
    }
);

// Admin: Add Product (Admin can add products without seller ID)
// Create uploads directory if it doesn't exist
// On platforms with read-only filesystems (e.g., Render), write to OS temp dir
const tempUploadDir = path.join(os.tmpdir(), "uploads", "products");
const uploadDir =
    process.env.NODE_ENV === "production" || process.env.RENDER
        ? tempUploadDir
        : "uploads/products";
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch (e) {
        console.error("Failed to create upload directory:", uploadDir, e);
    }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const fileName =
            "product-" + uniqueSuffix + path.extname(file.originalname);
        cb(null, fileName);
    },
});

const upload = multer({
    storage: storage,
    limits: {
        // Increase limit to support typical mobile videos (up to ~50MB)
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype.startsWith("image/") ||
            file.mimetype.startsWith("video/")
        ) {
            cb(null, true);
        } else {
            cb(new Error("Only image or video files are allowed!"), false);
        }
    },
});

// Serve static files for uploaded images
app.use("/uploads", express.static("uploads"));

// Updated API endpoint to handle both JSON and multipart data
app.post(
    "/api/admin/items",
    authenticateToken,
    requireAdmin,
    (req, res, next) => {
        // Check content type to decide how to handle the request
        const contentType = req.get("Content-Type");

        if (contentType && contentType.includes("multipart/form-data")) {
            // Handle file upload
            // Accept up to 4 images as 'images', optional single 'video', and legacy single 'media'
            upload.fields([
                { name: "images", maxCount: 4 },
                { name: "video", maxCount: 1 },
                { name: "media", maxCount: 1 }, // backward compatibility
            ])(req, res, (err) => {
                if (err) {
                    console.error("Multer error on /api/admin/items:", err);
                    const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
                    return res.status(statusCode).json({
                        success: false,
                        message: err.message || "File upload error",
                    });
                }
                next();
            });
        } else {
            // Handle JSON data (no file upload)
            next();
        }
    },
    async (req, res) => {
        try {
            console.log("Request body:", req.body);
            console.log("Uploaded files:", req.files);
            console.log("Content-Type:", req.get("Content-Type"));

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const {
                name,
                productDetails,
                price,
                category,
                quantity,
                unit,
                imageUrl, // from JSON requests
                imageUrls, // array from JSON requests
                videoUrl, // from JSON requests
                discount = 0,
                tax = 0,
                hasVAT = false,
                isSpecialItem = false,
            } = req.body;

            // Parse variants (can arrive as JSON or as a string in multipart)
            let variants = req.body.variants;
            if (typeof variants === "string" && variants.trim()) {
                try {
                    variants = JSON.parse(variants);
                } catch (e) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid variants format",
                    });
                }
            }
            const hasValidVariants = Array.isArray(variants) && variants.length > 0 &&
                variants.every(v => v && v.label != null && v.price != null && v.quantity != null);
            let parsedVariants = hasValidVariants
                ? variants.map(v => ({
                    label: String(v.label).trim(),
                    price: Number(v.price),
                    quantity: Number(v.quantity),
                }))
                : [];

            // Validate basic required fields
            if (!name || !productDetails || !category) {
                return res.status(400).json({
                    success: false,
                    message: "Product name, category and description are required",
                });
            }
            if (!parsedVariants.length) {
                return res.status(400).json({
                    success: false,
                    message: "Variants are required",
                });
            }

            // Collect media URLs (support up to 4 images + optional 1 video)
            const finalImages = [];
            let finalVideoUrl = "";

            // 1) From multipart uploads -> upload to Cloudinary
            if (
                req.files &&
                (req.files.images || req.files.video || req.files.media)
            ) {
                // Ensure Cloudinary is configured
                if (
                    !cloudinary.config().cloud_name ||
                    !cloudinary.config().api_key ||
                    !cloudinary.config().api_secret
                ) {
                    return res.status(500).json({
                        success: false,
                        message: "Media upload service is not configured",
                    });
                }
                const imageFiles = req.files.images || [];
                const legacyMedia = req.files.media || [];
                // If legacy media is an image, treat it as image; if video, as video
                legacyMedia.forEach((f) => {
                    if (f.mimetype && f.mimetype.startsWith("image/")) imageFiles.push(f);
                });
                const videoFiles =
                    req.files.video ||
                    legacyMedia.filter(
                        (f) => f.mimetype && f.mimetype.startsWith("video/")
                    );

                if (imageFiles.length > 4) {
                    return res
                        .status(400)
                        .json({ success: false, message: "Maximum 4 images allowed" });
                }

                // Upload images sequentially to avoid rate limits
                for (const file of imageFiles) {
                    const uploadRes = await cloudinary.uploader.upload(file.path, {
                        folder: "products",
                        resource_type: "image",
                    });
                    finalImages.push(uploadRes.secure_url);
                    try {
                        fs.unlinkSync(file.path);
                    } catch (e) { }
                }

                if (videoFiles && videoFiles[0]) {
                    const vfile = videoFiles[0];
                    const vRes = await cloudinary.uploader.upload(vfile.path, {
                        folder: "products",
                        resource_type: "video",
                    });
                    finalVideoUrl = vRes.secure_url;
                    try {
                        fs.unlinkSync(vfile.path);
                    } catch (e) { }
                }
            }

            // 2) From JSON body
            if (!finalImages.length) {
                if (Array.isArray(imageUrls)) {
                    if (imageUrls.length > 4) {
                        return res
                            .status(400)
                            .json({ success: false, message: "Maximum 4 images allowed" });
                    }
                    finalImages.push(...imageUrls.filter(Boolean));
                } else if (imageUrl) {
                    finalImages.push(imageUrl);
                }
            }
            if (!finalVideoUrl && videoUrl) {
                finalVideoUrl = videoUrl;
            }

            console.log("Final media to save:", {
                images: finalImages,
                videoUrl: finalVideoUrl,
            });

            // Require at least one media (image or video)
            if (!finalImages.length && !finalVideoUrl) {
                return res.status(400).json({
                    success: false,
                    message: "Product media is required",
                });
            }

            // Prepare variants already parsed above and derive top-level price/quantity for compatibility
            // Derive top-level price as first variant price (if exists) or provided price
            const derivedPrice = parsedVariants.length ? parsedVariants[0].price : (price ? parseFloat(price) : undefined);
            // Derive total quantity as sum of variant quantities or provided quantity
            const derivedQuantity = parsedVariants.length ? parsedVariants.reduce((s, vv) => s + Number(vv.quantity), 0) : (quantity ? parseInt(quantity) : undefined);

            const item = new Item({
                name: name.trim(),
                productDetails: productDetails.trim(),
                price: derivedPrice,
                category: category.trim(),
                imageUrl: finalImages[0] || "",
                images: finalImages,
                videoUrl: finalVideoUrl || "",
                quantity: derivedQuantity,
                unit: unit ? String(unit).trim() : undefined,
                variants: parsedVariants,
                sellerId: user._id,
                sellerName: user.name,
                storeName: user.storeName || user.name,
                discount: parseFloat(discount),
                tax: parseFloat(tax),
                hasVAT: hasVAT === "true" || hasVAT === true,
                isAvailable: true,
                isSpecialItem: isSpecialItem === "true" || isSpecialItem === true,
            });

            const savedItem = await item.save();
            console.log("Item saved with imageUrl:", savedItem.imageUrl);

            res.status(201).json({
                success: true,
                message: "Product added successfully by admin!",
                item: savedItem,
            });
        } catch (error) {
            console.error("Admin add item error:", error);
            console.error("Error stack:", error.stack);

            // More specific error handling
            if (error.name === "ValidationError") {
                const validationErrors = Object.values(error.errors)
                    .map((e) => e.message)
                    .join(", ");
                return res.status(400).json({
                    success: false,
                    message: `Validation error: ${validationErrors}`,
                });
            }

            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: "Product with this name already exists",
                });
            }

            res.status(500).json({
                success: false,
                message: "Failed to add product. Please try again.",
                error:
                    process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
    }
);

// Alternative approach: Create separate endpoints for different upload methods
// This might be cleaner if you want to handle them differently

// Endpoint for JSON requests (predefined images, custom URLs)
app.post(
    "/api/admin/items/json",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            console.log("JSON Request body:", req.body);

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const {
                name,
                productDetails,
                price,
                category,
                quantity,
                unit,
                imageUrl,
                imageUrls,
                videoUrl,
                discount = 0,
                tax = 0,
                hasVAT = false,
            } = req.body;

            // Parse variants if provided (may be JSON string)
            let variants = req.body.variants;
            if (typeof variants === "string" && variants.trim()) {
                try {
                    variants = JSON.parse(variants);
                } catch (e) {
                    // leave as string; will fail validation below
                }
            }

            const hasValidVariants = Array.isArray(variants) && variants.length > 0 && variants.every(v => v && v.label && !isNaN(Number(v.price)) && !isNaN(Number(v.quantity)));

            // Validate required fields (strict): name, details, category, variants, and media
            if (!name || !productDetails || !category) {
                return res.status(400).json({ success: false, message: "Product name, category and description are required" });
            }

            console.log("Media URLs from request:", {
                imageUrl,
                imageUrls,
                videoUrl,
            });
            const imagesArr = Array.isArray(imageUrls)
                ? imageUrls.filter(Boolean)
                : imageUrl
                    ? [imageUrl]
                    : [];
            if (imagesArr.length > 4) {
                return res
                    .status(400)
                    .json({ success: false, message: "Maximum 4 images allowed" });
            }

            if (!hasValidVariants) {
                return res.status(400).json({ success: false, message: "Variants are required" });
            }
            if (!imagesArr.length && !videoUrl) {
                return res.status(400).json({ success: false, message: "Product media is required" });
            }

            // Prepare parsed variants and derive compatibility fields
            let parsedVariants = hasValidVariants ? variants.map(v => ({ label: String(v.label).trim(), price: Number(v.price), quantity: Number(v.quantity) })) : [];
            const derivedPrice = parsedVariants.length ? parsedVariants[0].price : (price ? parseFloat(price) : undefined);
            const derivedQuantity = parsedVariants.length ? parsedVariants.reduce((s, vv) => s + Number(vv.quantity), 0) : (quantity ? parseInt(quantity) : undefined);

            // Create item
            const item = new Item({
                name: name.trim(),
                productDetails: productDetails.trim(),
                price: derivedPrice,
                category: category.trim(),
                imageUrl: imagesArr[0] || "",
                images: imagesArr,
                videoUrl: videoUrl || "",
                quantity: derivedQuantity,
                unit: unit ? String(unit).trim() : undefined,
                variants: parsedVariants,
                sellerId: user._id,
                sellerName: user.name,
                storeName: user.storeName || user.name,
                discount: parseFloat(discount),
                tax: parseFloat(tax),
                hasVAT: hasVAT === "true" || hasVAT === true,
                isAvailable: true,
            });

            const savedItem = await item.save();
            console.log("Item saved with imageUrl:", savedItem.imageUrl);

            res.status(201).json({
                success: true,
                message: "Product added successfully by admin!",
                item: savedItem,
            });
        } catch (error) {
            console.error("Admin add item error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to add product. Please try again.",
                error:
                    process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
    }
);

// Endpoint for file uploads
app.post(
    "/api/admin/items/upload",
    authenticateToken,
    requireAdmin,
    upload.single("media"),
    async (req, res) => {
        try {
            console.log("Upload Request body:", req.body);
            console.log("Uploaded file:", req.file);

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const {
                name,
                productDetails,
                price,
                category,
                quantity,
                unit,
                discount = 0,
                tax = 0,
                hasVAT = false,
                isSpecialItem = false,
            } = req.body;

            // Parse variants if provided (may be JSON string)
            let variants = req.body.variants;
            if (typeof variants === "string" && variants.trim()) {
                try {
                    variants = JSON.parse(variants);
                } catch (e) {
                    // leave as string; will fail validation below
                }
            }

            const hasValidVariants = Array.isArray(variants) && variants.length > 0 && variants.every(v => v && v.label && !isNaN(Number(v.price)) && !isNaN(Number(v.quantity)));

            // Validate required fields (strict): name, details, category, variants, and media
            if (!name || !productDetails || !category) {
                return res.status(400).json({ success: false, message: "Product name, category and description are required" });
            }
            if (!hasValidVariants) {
                return res.status(400).json({ success: false, message: "Variants are required" });
            }

            // Generate media URL from uploaded file (require at least one file)
            let imageUrl = "";
            let videoUrl = "";
            if (req.file) {
                const fileUrl = `${req.protocol}://${req.get("host")}/uploads/products/${req.file.filename}`;
                if (req.file.mimetype.startsWith("image/")) {
                    imageUrl = fileUrl;
                } else if (req.file.mimetype.startsWith("video/")) {
                    videoUrl = fileUrl;
                }
            }
            if (!imageUrl && !videoUrl) {
                return res.status(400).json({ success: false, message: "Product media is required" });
            }

            console.log("Generated media URL from upload:", { imageUrl, videoUrl });

            // Prepare parsed variants and derive compatibility fields
            let parsedVariants = hasValidVariants ? variants.map(v => ({ label: String(v.label).trim(), price: Number(v.price), quantity: Number(v.quantity) })) : [];
            const derivedPrice = parsedVariants.length ? parsedVariants[0].price : (price ? parseFloat(price) : undefined);
            const derivedQuantity = parsedVariants.length ? parsedVariants.reduce((s, vv) => s + Number(vv.quantity), 0) : (quantity ? parseInt(quantity) : undefined);

            // Create item
            const item = new Item({
                name: name.trim(),
                productDetails: productDetails.trim(),
                price: derivedPrice,
                category: category.trim(),
                imageUrl: imageUrl,
                videoUrl: videoUrl,
                quantity: derivedQuantity,
                unit: unit ? String(unit).trim() : undefined,
                variants: parsedVariants,
                sellerId: user._id,
                sellerName: user.name,
                storeName: user.storeName || user.name,
                discount: parseFloat(discount),
                tax: parseFloat(tax),
                hasVAT: hasVAT === "true" || hasVAT === true,
                isAvailable: true,
                isSpecialItem: isSpecialItem === "true" || isSpecialItem === true,
            });

            const savedItem = await item.save();
            console.log("Item saved with imageUrl:", savedItem.imageUrl);

            res.status(201).json({
                success: true,
                message: "Product added successfully by admin!",
                item: savedItem,
            });
        } catch (error) {
            console.error("Admin add item upload error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to add product. Please try again.",
                error:
                    process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
    }
);


// Admin: Get Single Product by ID
app.get(
    "/api/admin/items/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const itemId = req.params.id;
            const item = await Item.findById(itemId);
            if (!item) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }
            res.json({ success: true, item });
        } catch (error) {
            console.error("Get single item error:", error);
            res.status(500).json({ success: false, message: "Failed to fetch product" });
        }
    }
);
// Admin: Update Product
app.put(
    "/api/admin/items/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const itemId = req.params.id;
            const updates = req.body;
            if ("isSpecialItem" in updates) {
                updates.isSpecialItem =
                    updates.isSpecialItem === "true" || updates.isSpecialItem === true;
            }

            // Parse variants if provided as string
            if (typeof updates.variants === "string" && updates.variants.trim()) {
                try {
                    updates.variants = JSON.parse(updates.variants);
                } catch (e) {
                    // ignore - validation will catch it later
                }
            }

            // If variants provided and valid, derive top-level price/quantity for compatibility
            if (Array.isArray(updates.variants) && updates.variants.length > 0) {
                const valid = updates.variants.every(v => v && v.label && !isNaN(Number(v.price)) && !isNaN(Number(v.quantity)));
                if (!valid) {
                    return res.status(400).json({ success: false, message: "Invalid variants array" });
                }
                // Derive top-level price as first variant price and total quantity
                updates.price = Number(updates.variants[0].price);
                updates.quantity = updates.variants.reduce((s, vv) => s + Number(vv.quantity), 0);
            }

            // Remove fields that shouldn't be updated
            delete updates.sellerId;
            delete updates.sellerName;
            delete updates.storeName;

            const updatedItem = await Item.findByIdAndUpdate(
                itemId,
                { ...updates, updatedAt: new Date() },
                { new: true }
            );

            if (!updatedItem) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found",
                });
            }

            res.json({
                success: true,
                message: "Product updated successfully!",
                item: updatedItem,
            });
        } catch (error) {
            console.error("Admin update item error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update product",
            });
        }
    }
);

// Admin: Delete Product
app.delete(
    "/api/admin/items/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const itemId = req.params.id;

            const deletedItem = await Item.findByIdAndDelete(itemId);

            if (!deletedItem) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found",
                });
            }

            res.json({
                success: true,
                message: "Product deleted successfully!",
            });
        } catch (error) {
            console.error("Admin delete item error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to delete product",
            });
        }
    }
);

// Admin: Get All Products (including hidden ones)

// Fetch admin products with discount > 0 (public, no auth required)
app.get("/api/admin-products/with-discount", async (req, res) => {
    try {
        const products = await Item.find({
            discount: { $gt: 0 },
            sellerName: "admin", // Use lowercase "admin" to match your database
            isAvailable: true,
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            count: products.length,
            products,
        });
    } catch (error) {
        console.error("Fetch admin discounted products error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch admin discounted products",
        });
    }
});

async function generateInvoicePDF(order) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => {
            const pdfBuffer = Buffer.concat(buffers);
            resolve(pdfBuffer);
        });
        doc.on("error", reject);

        try {
            // Header
            doc.fillColor("#2563eb").fontSize(28).text("INVOICE", 50, 50);

            // Company Info
            doc
                .fillColor("#000000")
                .fontSize(12)
                .text("Your Company Name", 400, 50)
                .text("123 Business Street", 400, 65)
                .text("Business City, State 12345", 400, 80)
                .text("Phone: +1 (555) 123-4567", 400, 95)
                .text("Email: info@yourcompany.com", 400, 110);

            // Invoice Details
            doc
                .fontSize(10)
                .fillColor("#666666")
                .text(`Invoice #: ${order.orderId}`, 50, 150)
                .text(
                    `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
                    50,
                    165
                )
                .text(
                    `Due Date: ${new Date(order.estimatedShiprocket).toLocaleDateString()}`,
                    50,
                    180
                )
                .text(`Payment Status: ${order.paymentStatus.toUpperCase()}`, 50, 195);

            // Customer Info
            doc
                .fontSize(12)
                .fillColor("#000000")
                .text("Bill To:", 50, 230)
                .fontSize(10)
                .text(order.address.name, 50, 250)
                .text(order.address.phone, 50, 265)
                .text(order.address.address, 50, 280)
                .text(
                    `${order.address.city}, ${order.address.state} ${order.address.pincode}`,
                    50,
                    295
                );

            // Table Header
            const tableTop = 350;
            doc.fontSize(10).fillColor("#000000");

            // Draw table header background
            doc.rect(50, tableTop, 500, 25).fillColor("#f3f4f6").fill();

            // Table headers
            doc
                .fillColor("#000000")
                .text("Item", 60, tableTop + 8)
                .text("Qty", 300, tableTop + 8)
                .text("Price", 350, tableTop + 8)
                .text("Amount", 450, tableTop + 8);

            // Table Items
            let yPosition = tableTop + 35;
            order.items.forEach((item, index) => {
                const amount = item.price * item.quantity;

                doc
                    .text(item.name, 60, yPosition)
                    .text(item.quantity.toString(), 300, yPosition)
                    .text(`$${item.price.toFixed(2)}`, 350, yPosition)
                    .text(`$${amount.toFixed(2)}`, 450, yPosition);

                yPosition += 20;
            });

            // Totals
            yPosition += 20;
            doc
                .text("Subtotal:", 400, yPosition)
                .text(`$${order.subtotal.toFixed(2)}`, 450, yPosition);

            yPosition += 15;
            doc
                .text("Shiprocket Fee:", 400, yPosition)
                .text(`$${order.shiprocketFee.toFixed(2)}`, 450, yPosition);

            yPosition += 15;
            doc
                .text("Tax:", 400, yPosition)
                .text(`$${order.taxAmount.toFixed(2)}`, 450, yPosition);

            yPosition += 20;
            doc
                .fontSize(12)
                .fillColor("#2563eb")
                .text("Total:", 400, yPosition)
                .text(`$${order.totalAmount.toFixed(2)}`, 450, yPosition);

            // Footer
            doc
                .fontSize(8)
                .fillColor("#666666")
                .text("Thank you for your business!", 50, yPosition + 60)
                .text(
                    "For any questions regarding this invoice, please contact us.",
                    50,
                    yPosition + 75
                );

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// ============== SHIPROCKET API ROUTES ==============

// Create Shiprocket Order (Public - allows guest checkout)
app.post("/api/shiprocket/create-order", async (req, res) => {
    try {
        const { orderId, orderData } = req.body;

        if (!orderId || !orderData) {
            return res.status(400).json({
                success: false,
                message: "Order ID and order data are required",
            });
        }

        // Validate items array early to avoid undefined.map crashes in service layer
        const itemsArr = Array.isArray(orderData?.items)
            ? orderData.items
            : (Array.isArray(orderData?.order_items) ? orderData.order_items : []);
        if (!Array.isArray(itemsArr) || itemsArr.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Order items array is required and cannot be empty",
            });
        }

        const result = await shiprocket.createShiprocketOrder({
            orderId,
            ...orderData,
        });

        if (result.success) {
            res.json({
                success: true,
                message: "Order created on Shiprocket successfully",
                shiprocketOrderId: result.shiprocketOrderId,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to create Shiprocket order",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error creating Shiprocket order:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Get Shipping Rates
app.post("/api/shiprocket/shipping-rates", authenticateToken, async (req, res) => {
    try {
        const { pickupLocationId, deliveryPincode, weight, orderValue } = req.body;

        if (!pickupLocationId || !deliveryPincode) {
            return res.status(400).json({
                success: false,
                message: "Pickup location ID and delivery pincode are required",
            });
        }

        const result = await shiprocket.getShippingRate(
            pickupLocationId,
            deliveryPincode,
            weight || 1,
            orderValue || 0
        );

        if (result.success) {
            res.json({
                success: true,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to fetch shipping rates",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error fetching shipping rates:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Track Shipment (Public - allows guest tracking)
app.get("/api/shiprocket/track/:trackingId", async (req, res) => {
    try {
        const { trackingId } = req.params;

        if (!trackingId) {
            return res.status(400).json({
                success: false,
                message: "Tracking ID is required",
            });
        }

        const result = await shiprocket.trackShipment(trackingId);

        if (result.success) {
            res.json({
                success: true,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to track shipment",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error tracking shipment:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Generate Label (Public)
app.post("/api/shiprocket/generate-label", async (req, res) => {
    try {
        const { shiprocketOrderIds } = req.body;

        if (!shiprocketOrderIds || !Array.isArray(shiprocketOrderIds) || shiprocketOrderIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Shiprocket order IDs array is required",
            });
        }

        const result = await shiprocket.generateLabel(shiprocketOrderIds);

        if (result.success) {
            res.json({
                success: true,
                message: "Label generated successfully",
                labelUrl: result.labelUrl,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to generate label",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error generating label:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Cancel Shiprocket Order (Public)
app.post("/api/shiprocket/cancel-order", async (req, res) => {
    try {
        const { shiprocketOrderId } = req.body;

        if (!shiprocketOrderId) {
            return res.status(400).json({
                success: false,
                message: "Shiprocket order ID is required",
            });
        }

        const result = await shiprocket.cancelShiprocketOrder(shiprocketOrderId);

        if (result.success) {
            res.json({
                success: true,
                message: "Order cancelled successfully",
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to cancel order",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Get Shipment Details (Public - allows guest order tracking)
app.get("/api/shiprocket/shipment/:shiprocketOrderId", async (req, res) => {
    try {
        const { shiprocketOrderId } = req.params;

        if (!shiprocketOrderId) {
            return res.status(400).json({
                success: false,
                message: "Shiprocket order ID is required",
            });
        }

        // Shiprocket expects a numeric order_id; coerce/validate here
        const numericId = String(shiprocketOrderId).match(/\d+/)?.[0];
        if (!numericId) {
            return res.status(400).json({
                success: false,
                message: "Shiprocket order id must be a number",
            });
        }

        const result = await shiprocket.getShipmentDetails(Number(numericId));

        if (result.success) {
            res.json({
                success: true,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to fetch shipment details",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error fetching shipment details:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Retry Shiprocket Order Creation (Admin Only)
app.post("/api/shiprocket/retry-order", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "Order ID is required",
            });
        }

        // Find the order
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Check if order is paid
        if (order.paymentStatus !== "paid") {
            return res.status(400).json({
                success: false,
                message: "Cannot create Shiprocket order for unpaid orders",
            });
        }

        // Get user details
        const user = await User.findById(order.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found for this order",
            });
        }

        console.log(`[SHIPROCKET RETRY] Attempting to retry order ${orderId}`);

        // Helper function for safe values
        const safeValue = (value, fallback) => {
            if (value === null || value === undefined || String(value).trim() === '') {
                return fallback;
            }
            return value;
        };

        // Split name into first and last name
        const fullName = safeValue(order.address?.name, "Customer");
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || "Customer";
        const lastName = nameParts.slice(1).join(' ') || "Name";

        // Prepare payload matching the working API format
        const uniqueSuffix = Date.now().toString().slice(-4) + Math.floor(Math.random() * 100);
        const shiprocketOrderId = `${order.orderId}-${uniqueSuffix}`;

        const apiPayload = {
            orderId: shiprocketOrderId,
            orderData: {
                billingCustomerName: firstName,
                billingLastName: lastName,
                billingEmail: safeValue(user.email, "customer@example.com"),
                billingPhone: safeValue(order.address?.phone, "9999999999"),
                billingAddress: safeValue(order.address?.address, "Address not provided"),
                billingCity: safeValue(order.address?.city, "Mumbai"),
                billingPincode: safeValue(order.address?.pincode, "400001"),
                billingState: safeValue(order.address?.state, "Maharashtra"),
                billingCountry: "India",
                shippingIsBilling: true,
                paymentMethod: "Prepaid",
                subtotal: Number(order.subtotal) || 100,
                shippingCharges: Number(order.shiprocketFee) || 0,
                transactionCharges: Number(order.convenienceFee || 0) * 1.18,
                weight: Number(order.weight) || 0.5,
                length: 10,
                breadth: 10,
                height: 10,
                items: (order.items || []).map(item => ({
                    name: safeValue(item.name, "Product"),
                    sku: safeValue(item.itemId || item.name, "SKU-001"),
                    quantity: Number(item.quantity) || 1,
                    price: Number(item.price) || 0,
                    discount: Number(item.discount) || 0,
                    tax: Number(item.tax) || 0
                }))
            }
        };

        // Ensure at least one item exists
        if (apiPayload.orderData.items.length === 0) {
            apiPayload.orderData.items.push({
                name: "Order Item",
                sku: "ITEM-001",
                quantity: 1,
                price: Number(order.subtotal) || 100,
                discount: 0,
                tax: 0
            });
        }

        // Call the working API endpoint
        try {
            const apiResponse = await axios.post(
                `${SERVER_BASE_URL}/api/shiprocket/create-order`,
                apiPayload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (apiResponse.data && apiResponse.data.success) {
                order.shiprocketOrderId = apiResponse.data.shiprocketOrderId || shiprocketOrderId;
                order.shipmentStatus = "created";
                order.shiprocketError = null;
                await order.save();

                console.log(`[SHIPROCKET RETRY] Success for order ${orderId}`);

                res.json({
                    success: true,
                    message: "Shiprocket order created successfully",
                    shiprocketOrderId: apiResponse.data.shiprocketOrderId,
                    data: apiResponse.data,
                });
            } else {
                const errorMsg = apiResponse.data?.error || apiResponse.data?.message || "Unknown error";
                order.shiprocketError = errorMsg;
                order.shipmentStatus = "failed";
                await order.save();

                console.error(`[SHIPROCKET RETRY] Failed for order ${orderId}: ${errorMsg}`);

                res.status(400).json({
                    success: false,
                    message: "Failed to create Shiprocket order",
                    error: errorMsg,
                });
            }
        } catch (apiError) {
            const errorMsg = apiError.response?.data?.error || apiError.response?.data?.message || apiError.message;
            order.shiprocketError = errorMsg;
            order.shipmentStatus = "failed";
            await order.save();

            console.error(`[SHIPROCKET RETRY] API call failed for order ${orderId}: ${errorMsg}`);

            res.status(400).json({
                success: false,
                message: "Failed to create Shiprocket order",
                error: errorMsg,
            });
        }
    } catch (error) {
        console.error("[SHIPROCKET RETRY] Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Get Failed Shiprocket Orders (Admin Only)
app.get("/api/shiprocket/failed-orders", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Find orders where Shiprocket creation failed
        const query = {
            paymentStatus: "paid",
            $or: [
                { shipmentStatus: "failed" },
                { shipmentStatus: "pending", shiprocketError: { $exists: true, $ne: null, $ne: "" } },
                { awbNumber: { $exists: false } },
                { awbNumber: null },
                { awbNumber: "" }
            ]
        };

        const failedOrders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('orderId userId address items paymentStatus shipmentStatus shiprocketError awbNumber createdAt totalAmount');

        const totalFailed = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalFailed / limit);

        res.json({
            success: true,
            data: {
                orders: failedOrders,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalOrders: totalFailed,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });
    } catch (error) {
        console.error("[SHIPROCKET] Error fetching failed orders:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// ============== END SHIPROCKET ROUTES ==============

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log("\n=== ADMIN SETUP ===");
    console.log("To create your first admin user, make a POST request to:");
    console.log(`http://your-server:${PORT}/api/create-admin`);
    console.log(
        'With body: { "name": "kanwarji", "email": "admin@example.com", "phone": "1234567890", "password": "Dalbiji@kanwarji277", "secretKey": "create-admin-secret-2024" }'
    );
    console.log("==================\n");
    console.log("\n=== ENVIRONMENT VARIABLES NEEDED ===");
    console.log("JWT_SECRET=your_jwt_secret");
    console.log("EMAIL_USER=your_email@gmail.com");
    console.log("EMAIL_PASSWORD=your_app_password");
    console.log("MONGODB_URI=your_mongodb_connection_string");
    console.log("INSTAMOJO_API_KEY=your_instamojo_api_key");
    console.log("INSTAMOJO_AUTH_TOKEN=your_instamojo_auth_token");
    console.log("SERVER_BASE_URL=http://your-server:3000 (used as redirect target for Instamojo callbacks)");
    console.log(
        "GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com"
    );
    console.log("=====================================\n");
}); 
