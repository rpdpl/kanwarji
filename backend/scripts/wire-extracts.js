const fs = require("fs");
const path = "server.js";
let src = fs.readFileSync(path, "utf8");

const pinStart = src.indexOf("// Pincodes in Delhi/NCR");
const gse = src.indexOf("async function getShippingEstimate");
if (pinStart < 0 || gse < 0) throw new Error("pin markers missing");
const closeIdx = src.indexOf("\n}\n\n", gse);
if (closeIdx < 0) throw new Error("getShippingEstimate close missing");
const pinEnd = closeIdx + 4;
src =
  src.slice(0, pinStart) +
  'const { shouldUseInstamojoForPincode, getShippingEstimate } = require("./src/utils/pincode");\n\n' +
  src.slice(pinEnd);

const schemaStart = src.indexOf("// Cart Schema");
const schemaEnd = src.indexOf("// Configure email transporter");
if (schemaStart < 0 || schemaEnd < 0) throw new Error("schema markers");
src =
  src.slice(0, schemaStart) +
  `const {
    User,
    Cart,
    Address,
    Order,
    SellerRequest,
    Item,
    OTP,
    CancellationRequest,
} = require("./src/models");

` +
  src.slice(schemaEnd);

const authStart = src.indexOf("// JWT Middleware");
const authEnd = src.indexOf("// Create Instamojo payment request endpoint");
if (authStart < 0 || authEnd < 0) throw new Error("auth markers");
src =
  src.slice(0, authStart) +
  `const { authenticateToken, requireAdmin } = require("./src/middleware/auth");
const { generateOTP, generateOrderId, calculateBilledWeight } = require("./src/utils/ids");

` +
  src.slice(authEnd);

src = src.replace(
  'require("dotenv").config();\nconst app = express();',
  'const env = require("./src/config/env");\nconst app = express();'
);

src = src.replace(
  `const INSTAMOJO_API_KEY = process.env.INSTAMOJO_API_KEY || process.env.INSTAMOJO_KEY || "";
const INSTAMOJO_AUTH_TOKEN = process.env.INSTAMOJO_AUTH_TOKEN || process.env.INSTAMOJO_TOKEN || "";
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || \`http://localhost:\${process.env.PORT || 3000}\`;
const CLIENT_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:5173";`,
  `const INSTAMOJO_API_KEY = env.INSTAMOJO_API_KEY;
const INSTAMOJO_AUTH_TOKEN = env.INSTAMOJO_AUTH_TOKEN;
const SERVER_BASE_URL = env.SERVER_BASE_URL;
const CLIENT_BASE_URL = env.CLIENT_BASE_URL;`
);

src = src.replace(
  'const mongoUri = (process.env.MONGODB_URI || "mongodb://localhost:27017/test").replace(/^MONGODB_URI=/, "");',
  "const mongoUri = env.MONGODB_URI;"
);

fs.writeFileSync(path, src);
console.log("OK lines", src.split("\n").length);
