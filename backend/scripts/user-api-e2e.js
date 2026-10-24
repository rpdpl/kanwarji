/**
 * Act as a real user/admin against local API + live Shiprocket.
 * Usage: node scripts/user-api-e2e.js
 */
require("dotenv").config();
const axios = require("axios");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { User, Item, Order } = require("../src/models");

const BASE = process.env.SERVER_BASE_URL || "http://127.0.0.1:5000";
const api = axios.create({
  baseURL: BASE,
  validateStatus: () => true,
  timeout: 60000,
});

function step(n, msg) {
  console.log(`\n[${n}] ${msg}`);
}

async function ensureUsers() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);

  let buyer = await User.findOne({ email: "local-buyer@test.com" });
  if (!buyer) {
    buyer = await User.create({
      name: "Local Buyer",
      email: "local-buyer@test.com",
      phone: "9000000002",
      password: await bcrypt.hash("buyer123", 10),
      userType: "buyer",
      isActive: true,
      isVerified: true,
    });
  } else {
    buyer.password = await bcrypt.hash("buyer123", 10);
    await buyer.save();
  }

  let admin = await User.findOne({ userType: "admin" });
  if (!admin) {
    admin = await User.create({
      name: "Local Admin",
      email: "local-admin@test.com",
      phone: "9000000001",
      password: await bcrypt.hash("admin123", 10),
      userType: "admin",
      isActive: true,
      isVerified: true,
    });
  }

  let item = await Item.findOne({ sellerName: "admin", isAvailable: true });
  if (!item) {
    item = await Item.create({
      name: "API E2E Mithai",
      productDetails: "User API e2e product",
      price: 250,
      category: "Mithai",
      quantity: 50,
      unit: "box",
      sellerId: admin._id,
      sellerName: "admin",
      isAvailable: true,
    });
  }

  await mongoose.disconnect();
  return {
    buyerEmail: buyer.email,
    buyerPass: "buyer123",
    adminEmail: admin.email,
    item,
  };
}

async function main() {
  console.log("=== USER API E2E (real Shiprocket) ===");
  console.log("BASE:", BASE);
  console.log("PICKUP:", process.env.SHIPROCKET_PICKUP_LOCATION || "(default)");

  step(0, "Health");
  const health = await api.get("/health");
  console.log(health.status, health.data);
  if (health.status !== 200) process.exit(1);

  const ctx = await ensureUsers();

  step(1, "Buyer login");
  const login = await api.post("/api/auth/login", {
    emailOrPhone: ctx.buyerEmail,
    password: ctx.buyerPass,
  });
  console.log(login.status, login.data?.success, login.data?.message || "");
  if (!login.data?.success || !login.data?.token) {
    console.error(login.data);
    process.exit(1);
  }
  const buyerToken = login.data.token;
  const auth = { Authorization: `Bearer ${buyerToken}` };

  step(2, "GET /api/auth/me");
  const me = await api.get("/api/auth/me", { headers: auth });
  console.log(me.status, me.data?.success, me.data?.user?.email || me.data);

  step(3, "GET /api/admin-items (catalog)");
  const catalog = await api.get("/api/admin-items", {
    params: { limit: 5, status: "available" },
  });
  console.log(
    catalog.status,
    catalog.data?.success,
    "items=",
    (catalog.data?.items || []).length
  );
  const product =
    (catalog.data?.items || []).find((i) => i.isAvailable !== false) ||
    ctx.item;
  if (!product?._id && !product?.id) {
    console.error("No product for order");
    process.exit(1);
  }
  const productId = product._id || product.id || ctx.item._id;
  const productName = product.name || ctx.item.name;
  const price = Number(product.price || ctx.item.price || 250);
  console.log("Using product:", productName, price, productId);

  step(4, "POST /api/shiprocket/shipping-rates (outstation 400001)");
  const rates = await api.post(
    "/api/shiprocket/shipping-rates",
    {
      pickupLocationId: "110006",
      deliveryPincode: "400001",
      weight: 0.5,
      orderValue: price,
    },
    { headers: auth }
  );
  console.log(rates.status, rates.data?.success, rates.data?.message || "");
  if (!rates.data?.success) {
    console.error(JSON.stringify(rates.data, null, 2));
    process.exit(1);
  }
  const couriers =
    rates.data?.data?.data?.available_courier_companies ||
    rates.data?.data?.available_courier_companies ||
    rates.data?.couriers ||
    [];
  console.log("couriers:", Array.isArray(couriers) ? couriers.length : "n/a");

  step(5, "POST /api/orders COD outstation (triggers Shiprocket create)");
  const orderBody = {
    items: [
      {
        itemId: productId,
        name: productName,
        price,
        quantity: 1,
        unit: product.unit || "box",
        variantLabel: "",
        sellerId: product.sellerId,
        sellerName: product.sellerName || "admin",
        tax: 0,
        discount: 0,
      },
    ],
    address: {
      name: "API E2E Buyer",
      phone: "9876543210",
      address: "12 Test Lane, Andheri",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    },
    paymentMethod: "cod",
    subtotal: price,
    shiprocketFee: 50,
    taxAmount: 0,
    totalAmount: price + 50,
    weight: 0.5,
    specialRequests: "user-api-e2e",
  };
  const orderRes = await api.post("/api/orders", orderBody, { headers: auth });
  console.log(orderRes.status, orderRes.data?.success, orderRes.data?.message || "");
  if (!orderRes.data?.success) {
    console.error(JSON.stringify(orderRes.data, null, 2));
    process.exit(1);
  }
  const order = orderRes.data.order || orderRes.data.data || orderRes.data;
  const orderId = order.orderId || orderRes.data.order_id || orderRes.data.orderId;
  console.log("orderId:", orderId);
  console.log("create response shipmentStatus:", order.shipmentStatus);
  console.log("create response shiprocketOrderId:", order.shiprocketOrderId);
  console.log("create response shiprocketError:", order.shiprocketError || "(none)");

  // Re-fetch order from DB via user orders if fields not in create response
  step(6, "GET /api/user/orders (confirm persisted Shiprocket fields)");
  const userOrders = await api.get("/api/user/orders", { headers: auth });
  console.log(userOrders.status, userOrders.data?.success);
  const list =
    userOrders.data?.orders ||
    userOrders.data?.data?.orders ||
    (Array.isArray(userOrders.data?.data) ? userOrders.data.data : null) ||
    [];
  console.log("user orders count:", Array.isArray(list) ? list.length : 0);
  let found = Array.isArray(list)
    ? list.find((o) => o.orderId === orderId)
    : null;
  if (found) {
    console.log("found shipmentStatus:", found.shipmentStatus);
    console.log("found shiprocketOrderId:", found.shiprocketOrderId);
    console.log("found shiprocketError:", found.shiprocketError || "(none)");
  } else {
    console.log("order not in user list yet; reading Mongo…");
  }

  let srId = found?.shiprocketOrderId || order.shiprocketOrderId;
  let srErr = found?.shiprocketError || order.shiprocketError;
  let srStatus = found?.shipmentStatus || order.shipmentStatus;

  if (!srId) {
    await mongoose.connect(process.env.MONGODB_URI);
    const dbOrder = await Order.findOne({ orderId }).lean();
    await mongoose.disconnect();
    srId = dbOrder?.shiprocketOrderId;
    srErr = dbOrder?.shiprocketError;
    srStatus = dbOrder?.shipmentStatus;
    found = dbOrder || found;
    console.log("DB:", { srId, srStatus, srErr: srErr || null });
  }

  if (!srId || srStatus === "failed" || srErr) {
    console.error("\nFAIL: Shiprocket not created on order path");
    console.error({ srId, srStatus, srErr });
    process.exit(1);
  }
  if (String(srId).startsWith("MOCK")) {
    console.error("\nFAIL: still mock id");
    process.exit(1);
  }

  step(7, "GET Shiprocket shipment details via API");
  const shipment = await api.get(`/api/shiprocket/shipment/${srId}`, {
    headers: auth,
  });
  console.log(shipment.status, shipment.data?.success, shipment.data?.message || "");
  if (shipment.data?.data) {
    const d = shipment.data.data?.data || shipment.data.data;
    console.log(
      "SR status/fields:",
      d?.status || d?.status_code || Object.keys(d || {}).slice(0, 8)
    );
  }

  step(8, "Admin login + GET /api/admin/orders");
  // reset admin password to known value for this run
  await mongoose.connect(process.env.MONGODB_URI);
  const adminDoc = await User.findOne({ userType: "admin" });
  adminDoc.password = await bcrypt.hash("admin123", 10);
  await adminDoc.save();
  const adminEmail = adminDoc.email;
  await mongoose.disconnect();

  const adminLogin = await api.post("/api/auth/login", {
    emailOrPhone: adminEmail,
    password: "admin123",
  });
  console.log(adminLogin.status, adminLogin.data?.success, adminEmail);
  if (!adminLogin.data?.token) {
    console.error(adminLogin.data);
    process.exit(1);
  }
  const adminAuth = { Authorization: `Bearer ${adminLogin.data.token}` };
  const adminOrders = await api.get("/api/admin/orders", {
    headers: adminAuth,
    params: { limit: 20 },
  });
  console.log(adminOrders.status, adminOrders.data?.success);
  const adminList = adminOrders.data?.data?.orders || [];
  const adminFound = adminList.find((o) => o.orderId === orderId);
  console.log("admin sees order?", !!adminFound);
  if (adminFound) {
    console.log(
      "admin view:",
      adminFound.orderId,
      adminFound.paymentMethod,
      adminFound.paymentStatus,
      adminFound.shipmentStatus,
      adminFound.shiprocketOrderId
    );
  } else {
    console.error("FAIL: admin list missing order", orderId);
    process.exit(1);
  }

  console.log("\n=== USER API E2E PASSED ===");
  console.log("Order", orderId, "→ Shiprocket", srId, "visible in admin.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
