/**
 * Mechanical extract: server.js → thin bootstrap + src/app.js + services + route modules.
 * Run from backend/: node scripts/split-backend.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const serverPath = path.join(ROOT, "server.js");
const lines = fs.readFileSync(serverPath, "utf8").split(/\r?\n/);

function slice(start1, end1) {
  return lines.slice(start1 - 1, end1).join("\n");
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function write(rel, content) {
  const full = path.join(ROOT, rel);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, content.replace(/\r\n/g, "\n"), "utf8");
  console.log("wrote", rel, content.split("\n").length, "lines");
}

function extractFunctionBody(startLine, endLine) {
  const block = lines.slice(startLine - 1, endLine).join("\n");
  // Skip parameter destructuring `{ ... }` — find the body after the param list `) {`
  const sigEnd = block.indexOf(")");
  const open =
    sigEnd === -1 ? block.indexOf("{") : block.indexOf("{", sigEnd);
  if (open === -1) {
    throw new Error("Cannot find body open " + startLine + "-" + endLine);
  }
  // Brace-match, ignoring braces inside template literals / strings / comments
  let depth = 0;
  let inS = null; // ' " `
  let close = -1;
  for (let i = open; i < block.length; i++) {
    const ch = block[i];
    const prev = block[i - 1];
    if (inS) {
      if (ch === inS && prev !== "\\") inS = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      inS = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) {
    throw new Error("Cannot find body close " + startLine + "-" + endLine);
  }
  return block.slice(open + 1, close);
}

const bak = path.join(ROOT, "server.pre-split.js.bak");
if (!fs.existsSync(bak)) {
  fs.copyFileSync(serverPath, bak);
  console.log("backup → server.pre-split.js.bak");
} else if (lines.length < 500) {
  console.error("server.js already thin; restore from bak first");
  process.exit(1);
}

// --- services/email.js ---
write(
  "services/email.js",
  `const nodemailer = require("nodemailer");
const env = require("../src/config/env");

const transporter = nodemailer.createTransport({
  service: env.EMAIL_SERVICE || "gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASSWORD,
  },
});

transporter.verify((err) => {
  if (err) {
    console.error("Email transporter verification failed:", err?.message || err);
  } else {
    console.log("Email transporter is ready to send messages");
  }
});

function formatIST(date) {
${extractFunctionBody(740, 764)}
}

async function sendSignupMail({ name, email, phone }) {
${extractFunctionBody(667, 695)}
}

async function sendPaymentSuccessEmail(user, order) {
${extractFunctionBody(766, 869)}
}

async function sendOrderConfirmationEmail(user, order) {
${extractFunctionBody(871, 919)}
}

async function sendOrderCancellationEmail(user, order, cancellationReason) {
${extractFunctionBody(3943, 4048)}
}

async function sendMail(mailOptions) {
  return transporter.sendMail(mailOptions);
}

module.exports = {
  transporter,
  formatIST,
  sendSignupMail,
  sendPaymentSuccessEmail,
  sendOrderConfirmationEmail,
  sendOrderCancellationEmail,
  sendMail,
};
`.replace(/process\.env\.EMAIL_USER/g, "env.EMAIL_USER")
);

// --- services/instamojo.js ---
write(
  "services/instamojo.js",
  `const axios = require("axios");
const env = require("../src/config/env");

const INSTAMOJO_API_KEY = env.INSTAMOJO_API_KEY;
const INSTAMOJO_AUTH_TOKEN = env.INSTAMOJO_AUTH_TOKEN;

const instamojoClient = axios.create({
  baseURL: "https://www.instamojo.com/api/1.1/",
  headers: {
    "X-Api-Key": INSTAMOJO_API_KEY,
    "X-Auth-Token": INSTAMOJO_AUTH_TOKEN,
    "Content-Type": "application/json",
  },
});

async function processInstamojoRefund(order) {
${extractFunctionBody(698, 738)}
}

module.exports = {
  instamojoClient,
  processInstamojoRefund,
  INSTAMOJO_API_KEY,
  INSTAMOJO_AUTH_TOKEN,
};
`
);

// --- middleware/upload.js ---
write(
  "src/middleware/upload.js",
  `const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileName =
      "product-" + uniqueSuffix + path.extname(file.originalname);
    cb(null, fileName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
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

module.exports = { upload, uploadDir };
`
);

// --- utils/invoice.js ---
write(
  "src/utils/invoice.js",
  `const PDFDocument = require("pdfkit");

async function generateInvoicePDF(order) {
${extractFunctionBody(6027, 6156)}
}

module.exports = { generateInvoicePDF };
`
);

const ROUTE_PREAMBLE = `const bcrypt = require("bcryptjs");
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
  console.log(\`[ORDER \${order.orderId}] Delhivery pickup skipped (integration removed)\`);
  return {
    success: false,
    message: "Delhivery pickup has been removed. Use Shiprocket for shipping.",
  };
}

`;

function wrapRoutes(name, body) {
  let b = body;
  b = b.replace(/await transporter\.sendMail/g, "await sendMail");
  b = b.replace(/transporter\.sendMail/g, "sendMail");
  return (
    ROUTE_PREAMBLE +
    "\nmodule.exports = function register" +
    name +
    "Routes(app) {\n" +
    b +
    "\n};\n"
  );
}

const routeFiles = [
  { file: "src/routes/payments.js", name: "Payments", ranges: [[154, 660]] },
  { file: "src/routes/cart.js", name: "Cart", ranges: [[926, 1476]] },
  { file: "src/routes/addresses.js", name: "Addresses", ranges: [[1478, 1753]] },
  {
    file: "src/routes/auth.js",
    name: "Auth",
    ranges: [
      [1755, 2204],
      [4688, 4754],
    ],
  },
  {
    file: "src/routes/admin.js",
    name: "Admin",
    ranges: [
      [2206, 2750],
      [3574, 3718],
      [4388, 4686],
      [4769, 5336],
      [5389, 6025],
    ],
  },
  { file: "src/routes/items.js", name: "Items", ranges: [[2752, 3189]] },
  {
    file: "src/routes/orders.js",
    name: "Orders",
    ranges: [
      [3191, 3572],
      [3720, 3795],
      [3807, 4386],
    ],
  },
  { file: "src/routes/misc.js", name: "Misc", ranges: [[4756, 4767]] },
  {
    file: "src/routes/shiprocket.js",
    name: "Shiprocket",
    ranges: [[6158, 6622]],
  },
];

for (const rf of routeFiles) {
  const parts = rf.ranges.map(([a, b]) => slice(a, b));
  write(rf.file, wrapRoutes(rf.name, parts.join("\n\n")));
}

write(
  "src/routes/index.js",
  `module.exports = function registerRoutes(app) {
  require("./payments")(app);
  require("./cart")(app);
  require("./addresses")(app);
  require("./auth")(app);
  require("./admin")(app);
  require("./items")(app);
  require("./orders")(app);
  require("./misc")(app);
  require("./shiprocket")(app);
};
`
);

write(
  "src/app.js",
  `console.log("!!! SERVER STARTUP DEBUG MARKET !!!");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const env = require("./config/env");
require("../services/email");
require("../services/instamojo");

const app = express();

const invoicesDir = path.join(__dirname, "..", "invoices");
if (!fs.existsSync(invoicesDir)) {
  fs.mkdirSync(invoicesDir, { recursive: true });
}

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Authorization"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/placeholder.svg", (req, res) => {
  const isThumb = req.query.thumb === "1" || req.query.thumb === "true";
  const size = isThumb ? 64 : 256;
  const bg = "#e5e7eb";
  const fg = "#9ca3af";
  const text = isThumb ? "" : "No Image";
  const fontSize = Math.floor(size * 0.16);
  const svg = \`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="\${size}" height="\${size}" viewBox="0 0 \${size} \${size}">
  <rect width="100%" height="100%" fill="\${bg}"/>
  <g fill="none" stroke="\${fg}" stroke-width="2">
    <rect x="\${size * 0.15}" y="\${size * 0.2}" width="\${size * 0.7}" height="\${size * 0.6}" rx="\${size * 0.04}"/>
    <circle cx="\${size * 0.4}" cy="\${size * 0.42}" r="\${size * 0.08}"/>
    <path d="M \${size * 0.3} \${size * 0.6} L \${size * 0.45} \${size * 0.48} L \${size * 0.6} \${size * 0.62} L \${size * 0.7} \${size * 0.54}" />
  </g>
  \${
    text
      ? \`<text x="50%" y="85%" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="\${fontSize}" fill="\${fg}">\${text}</text>\`
      : ""
  }
</svg>\`;
  res.set("Cache-Control", "public, max-age=86400, immutable");
  res.type("image/svg+xml").send(svg);
});

mongoose
  .connect(env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Mongo connected"))
  .catch((err) => console.log("Error:", err));

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected successfully");
});

require("./models");
app.use("/uploads", express.static("uploads"));
require("./routes")(app);

module.exports = app;
`
);

write(
  "server.js",
  `const app = require("./src/app");
const env = require("./src/config/env");

const PORT = env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(\`Server running on port \${PORT}\`);
  console.log("\\n=== ADMIN SETUP ===");
  console.log("To create your first admin user, make a POST request to:");
  console.log(\`http://your-server:\${PORT}/api/create-admin\`);
  console.log("==================\\n");
});
`
);

console.log("DONE split");
