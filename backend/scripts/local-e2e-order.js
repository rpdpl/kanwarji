/**
 * Local e2e: create a COD outstation order in Mongo + Shiprocket (mock or live),
 * then print what admin /api/admin/orders would see.
 *
 * Usage: node scripts/local-e2e-order.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  User,
  Item,
  Order,
} = require("../src/models");
const shiprocket = require("../services/shiprocket");
const { generateOrderId, calculateBilledWeight } = require("../src/utils/ids");
const { shouldUseInstamojoForPincode } = require("../src/utils/pincode");

async function main() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/vikas_local";
  await mongoose.connect(uri);
  console.log("Mongo:", uri);
  console.log(
    "Shiprocket pickup:",
    process.env.SHIPROCKET_PICKUP_LOCATION || "Primary"
  );

  let admin = await User.findOne({ userType: "admin" });
  if (!admin) {
    const hash = await bcrypt.hash("admin123", 10);
    admin = await User.create({
      name: "Local Admin",
      email: "local-admin@test.com",
      phone: "9000000001",
      password: hash,
      userType: "admin",
      isActive: true,
      isVerified: true,
    });
    console.log("Created admin:", admin.email, "password: admin123");
  } else {
    console.log("Using admin:", admin.email);
  }

  let buyer = await User.findOne({ email: "local-buyer@test.com" });
  if (!buyer) {
    const hash = await bcrypt.hash("buyer123", 10);
    buyer = await User.create({
      name: "Local Buyer",
      email: "local-buyer@test.com",
      phone: "9000000002",
      password: hash,
      userType: "buyer",
      isActive: true,
      isVerified: true,
    });
    console.log("Created buyer:", buyer.email, "password: buyer123");
  }

  let item = await Item.findOne({ sellerName: "admin", isAvailable: true });
  if (!item) {
    item = await Item.create({
      name: "E2E Kaju Katli",
      productDetails: "Local e2e test product",
      price: 299,
      category: "Mithai",
      quantity: 100,
      unit: "box",
      sellerId: admin._id,
      sellerName: "admin",
      isAvailable: true,
    });
    console.log("Created product:", item.name);
  }

  const pincode = "400001"; // outstation → should hit Shiprocket
  console.log(
    "Pincode",
    pincode,
    "local/NCR?",
    shouldUseInstamojoForPincode(pincode)
  );

  const orderId = generateOrderId();
  const order = await Order.create({
    userId: buyer._id,
    orderId,
    items: [
      {
        itemId: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        unit: item.unit || "box",
        variantLabel: "",
        sellerId: admin._id,
        sellerName: "admin",
        tax: 0,
        discount: 0,
      },
    ],
    address: {
      name: "Local Buyer",
      phone: "9000000002",
      address: "Test Street 1",
      city: "Mumbai",
      state: "Maharashtra",
      pincode,
    },
    paymentMethod: "cod",
    paymentStatus: "pending",
    subtotal: item.price,
    weight: calculateBilledWeight(0.5),
    shiprocketFee: 50,
    taxAmount: 0,
    totalAmount: item.price + 50,
    orderStatus: "confirmed",
    estimatedShiprocket: new Date(Date.now() + 7 * 86400000),
  });

  const sr = await shiprocket.createShiprocketOrder({
    orderId: order.orderId,
    billingCustomerName: order.address.name,
    billingEmail: buyer.email,
    billingPhone: order.address.phone,
    billingAddress: order.address.address,
    billingCity: order.address.city,
    billingPincode: order.address.pincode,
    billingState: order.address.state,
    paymentMethod: "COD",
    subtotal: order.subtotal,
    weight: order.weight,
    shippingCharges: order.shiprocketFee,
    items: order.items.map((i) => ({
      name: i.name,
      sku: String(i.itemId || i.name),
      quantity: i.quantity,
      price: i.price,
    })),
  });

  if (sr.success) {
    order.shiprocketOrderId = sr.shiprocketOrderId;
    order.shipmentStatus = "created";
    order.shiprocketError = null;
  } else {
    order.shipmentStatus = "failed";
    order.shiprocketError = sr.error;
  }
  await order.save();

  const token = jwt.sign(
    { id: admin._id.toString(), email: admin.email },
    process.env.JWT_SECRET || "local-dev-secret-change-me",
    { expiresIn: "1d" }
  );

  console.log("\n=== E2E RESULT ===");
  console.log("orderId:", order.orderId);
  console.log("paymentMethod:", order.paymentMethod, "paymentStatus:", order.paymentStatus);
  console.log("shipmentStatus:", order.shipmentStatus);
  console.log("shiprocketOrderId:", order.shiprocketOrderId);
  console.log("shiprocketError:", order.shiprocketError || "(none)");
  console.log("\nAdmin JWT (for curl):", token.slice(0, 24) + "…");
  console.log(
    `\ncurl -H "Authorization: Bearer ${token}" "http://localhost:5000/api/admin/orders?limit=5"`
  );
  console.log(
    "\nAdmin UI: login as",
    admin.email,
    "→ /admin/dashboard/orders — COD orders now visible."
  );

  await mongoose.disconnect();
  process.exit(sr.success ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
