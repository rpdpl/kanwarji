/**
 * Live Shiprocket smoke test using backend/.env
 * Usage: node scripts/shiprocket-smoke.js
 * Does NOT print secrets. Creates one adhoc demo order then cancels it.
 */
require("dotenv").config();
const shiprocket = require("../services/shiprocket");

function mask(v) {
  if (!v) return "(empty)";
  const s = String(v);
  if (s.length <= 4) return "****";
  return s.slice(0, 2) + "****" + s.slice(-2);
}

async function main() {
  console.log("=== Shiprocket live smoke ===");
  console.log("EMAIL set:", mask(process.env.SHIPROCKET_EMAIL));
  console.log("PASSWORD set:", process.env.SHIPROCKET_PASSWORD ? "yes" : "no");
  console.log("CHANNEL_ID:", process.env.SHIPROCKET_CHANNEL_ID || "(empty — OK)");
  console.log(
    "PICKUP:",
    process.env.SHIPROCKET_PICKUP_LOCATION || "Primary"
  );

  // 1) Auth
  console.log("\n[1] Auth login…");
  const token = await shiprocket.getShiprocketToken();
  if (!token) {
    console.error("FAIL: authentication failed. Check SHIPROCKET_EMAIL / PASSWORD.");
    process.exit(1);
  }
  console.log("OK: got token (" + token.slice(0, 8) + "…)");

  // 2) Rate quote (Delhi pickup → Mumbai)
  console.log("\n[2] Shipping rate 110006 → 400001…");
  const rate = await shiprocket.getShippingRate("110006", "400001", 0.5, 500);
  if (!rate.success) {
    console.error("FAIL: rate quote:", rate.error);
    console.error(JSON.stringify(rate.data || {}, null, 2));
    process.exit(1);
  }
  const couriers =
    rate.data?.data?.available_courier_companies ||
    rate.data?.available_courier_companies ||
    [];
  console.log("OK: couriers available:", couriers.length);
  if (couriers[0]) {
    console.log(
      "  sample:",
      couriers[0].courier_name || couriers[0].courier_company_id,
      "₹" + (couriers[0].rate ?? couriers[0].freight_charge ?? "?")
    );
  }

  // 3) Demo create order (then cancel)
  const demoOrderId = "SMOKE-" + Date.now();
  console.log("\n[3] Create demo adhoc order", demoOrderId, "…");
  const pickup =
    process.env.SHIPROCKET_PICKUP_LOCATION || "Primary";
  const created = await shiprocket.createShiprocketOrder({
    orderId: demoOrderId,
    pickupLocation: pickup,
    billingCustomerName: "Smoke Test",
    billingAddress: "Test Address Line 1",
    billingCity: "Mumbai",
    billingPincode: "400001",
    billingState: "Maharashtra",
    billingEmail: process.env.SHIPROCKET_EMAIL || "smoke@example.com",
    billingPhone: "9876543210",
    paymentMethod: "Prepaid",
    subtotal: 199,
    weight: 0.5,
    shippingCharges: 0,
    items: [
      {
        name: "Smoke Test Mithai",
        sku: "SMOKE-SKU-1",
        quantity: 1,
        price: 199,
        discount: 0,
        tax: 0,
      },
    ],
  });

  if (!created.success) {
    console.error("FAIL: create order:", created.error);
    console.error(JSON.stringify(created.data || {}, null, 2));
    console.error(
      "\nHint: set SHIPROCKET_PICKUP_LOCATION to the exact nickname from Shiprocket pickup list (this shop: work)."
    );
    process.exit(1);
  }

  console.log("OK: Shiprocket order id:", created.shiprocketOrderId);
  console.log("    shipment_id:", created.data?.shipment_id || "(n/a)");
  console.log("    channel_order_id:", created.data?.channel_order_id || demoOrderId);

  // 4) Cancel demo (Shiprocket cancel API expects numeric order id)
  console.log("\n[4] Cancel demo order…");
  const cancelled = await shiprocket.cancelShiprocketOrder(created.shiprocketOrderId);
  if (!cancelled.success) {
    console.warn("WARN: cancel failed (order may remain in panel):", cancelled.error);
    console.warn("Cancel manually in Shiprocket for id:", created.shiprocketOrderId);
  } else {
    console.log("OK: cancel requested");
  }

  console.log("\n=== SMOKE PASSED ===");
  console.log("Auth + rates + create work. Check Shiprocket panel for", demoOrderId);
}

main().catch((err) => {
  console.error("Unexpected error:", err?.message || err);
  process.exit(1);
});
