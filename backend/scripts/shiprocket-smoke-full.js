/**
 * Full live Shiprocket smoke (standard + Quick hyperlocal).
 * Creates real orders you can see in the Shiprocket panel, prints IDs,
 * fetches order details, then cancels the demo orders.
 *
 * Usage: node scripts/shiprocket-smoke-full.js
 * Optional: KEEP_ORDERS=1 to skip cancel (leave visible in panel)
 */
require("dotenv").config();
const shiprocket = require("../services/shiprocket");

function mask(v) {
  if (!v) return "(empty)";
  const s = String(v);
  if (s.length <= 4) return "****";
  return s.slice(0, 2) + "****" + s.slice(-2);
}

function listCouriers(rateData) {
  if (Array.isArray(rateData?.data)) return rateData.data;
  return (
    rateData?.data?.available_courier_companies ||
    rateData?.available_courier_companies ||
    rateData?.data?.data?.available_courier_companies ||
    []
  );
}

function pickCourier(couriers) {
  if (!couriers.length) return null;
  return couriers.reduce((best, cur) => {
    const br = Number(best?.rate ?? best?.rates ?? best?.freight_charge ?? Infinity);
    const cr = Number(cur?.rate ?? cur?.rates ?? cur?.freight_charge ?? Infinity);
    return cr < br ? cur : best;
  }, couriers[0]);
}

async function main() {
  const keepOrders = process.env.KEEP_ORDERS === "1";
  const pickup = process.env.SHIPROCKET_PICKUP_LOCATION || "Primary";
  const shopLat = Number(process.env.SHIPROCKET_PICKUP_LAT);
  const shopLong = Number(process.env.SHIPROCKET_PICKUP_LONG);
  // Nearby drop ~3.7km from shop (Connaught Place area — known Quick-serviceable)
  const dropLat = 28.6328;
  const dropLong = 77.2197;

  console.log("=== Shiprocket FULL live smoke (standard + Quick) ===");
  console.log("EMAIL:", mask(process.env.SHIPROCKET_EMAIL));
  console.log("PASSWORD:", process.env.SHIPROCKET_PASSWORD ? "yes" : "no");
  console.log("PICKUP nickname:", pickup);
  console.log("PICKUP_LAT/LONG:", shopLat || "(missing)", shopLong || "(missing)");
  console.log("KEEP_ORDERS:", keepOrders ? "yes (will NOT cancel)" : "no (will cancel demos)");

  // ─── 1) Auth ───
  console.log("\n[1] Auth…");
  const token = await shiprocket.getShiprocketToken();
  if (!token) {
    console.error("FAIL: auth —", shiprocket.getLastAuthError?.());
    process.exit(1);
  }
  console.log("OK: token", token.slice(0, 12) + "…");

  // ─── 2) Standard rates (Delhi → Mumbai) ───
  console.log("\n[2] Standard rates 110006 → 400001…");
  const stdRate = await shiprocket.getShippingRate("110006", "400001", 0.5, 500, {
    mode: "standard",
  });
  if (!stdRate.success) {
    console.error("FAIL: standard rates:", stdRate.error);
    console.error(JSON.stringify(stdRate.data || {}, null, 2));
    process.exit(1);
  }
  const stdCouriers = listCouriers(stdRate.data);
  const stdPick = pickCourier(stdCouriers);
  console.log("OK: standard couriers:", stdCouriers.length);
  if (stdPick) {
    console.log(
      "  cheapest sample:",
      stdPick.courier_name,
      "id=",
      stdPick.courier_company_id || stdPick.id,
      "₹" + (stdPick.rate ?? stdPick.freight_charge)
    );
  }

  // ─── 3) Quick / hyperlocal rates ───
  console.log("\n[3] Quick hyperlocal rates (shop → nearby Delhi)…");
  if (!Number.isFinite(shopLat) || !Number.isFinite(shopLong)) {
    console.error("FAIL: SHIPROCKET_PICKUP_LAT / LONG missing in .env");
    process.exit(1);
  }
  const quickRate = await shiprocket.getShippingRate(
    "110006",
    "110001",
    0.5,
    500,
    { mode: "quick", lat: dropLat, long: dropLong, cod: 0 }
  );
  let quickPick = null;
  if (!quickRate.success) {
    console.error("FAIL: Quick rates:", quickRate.error);
    console.error(JSON.stringify(quickRate.data || {}, null, 2));
    console.error(
      "\nQuick must be enabled on this Shiprocket account. Standard path will still be tested."
    );
  } else {
    const qCouriers = listCouriers(quickRate.data);
    quickPick = pickCourier(qCouriers);
    console.log("OK: Quick couriers:", qCouriers.length);
    if (quickPick) {
      console.log(
        "  sample:",
        quickPick.courier_name,
        "id=",
        quickPick.courier_company_id || quickPick.id || "(auto)",
        "₹" + (quickPick.rate ?? quickPick.rates ?? quickPick.freight_charge)
      );
    } else {
      console.warn("WARN: Quick API OK but no couriers returned for these coords");
    }
  }

  const createdIds = [];

  // ─── 4) Create STANDARD adhoc order ───
  const stdOrderId = "SMOKE-STD-" + Date.now();
  console.log("\n[4] Create STANDARD order", stdOrderId, "…");
  const stdCreated = await shiprocket.createShiprocketOrder({
    orderId: stdOrderId,
    pickupLocation: pickup,
    billingCustomerName: "Smoke Standard",
    billingAddress: "Test Address Line 1 Andheri",
    billingCity: "Mumbai",
    billingPincode: "400001",
    billingState: "Maharashtra",
    billingEmail: process.env.SHIPROCKET_EMAIL || "smoke@example.com",
    billingPhone: "9876543210",
    paymentMethod: "Prepaid",
    shippingMode: "standard",
    subtotal: 199,
    weight: 0.5,
    shippingCharges: Number(stdPick?.rate || 0),
    items: [
      {
        name: "Smoke Standard Mithai",
        sku: "SMOKE-STD-1",
        quantity: 1,
        price: 199,
        discount: 0,
        tax: 0,
      },
    ],
  });

  if (!stdCreated.success) {
    console.error("FAIL: standard create:", stdCreated.error);
    console.error(JSON.stringify(stdCreated.data || {}, null, 2));
    process.exit(1);
  }
  createdIds.push(stdCreated.shiprocketOrderId);
  console.log("OK: STANDARD created");
  console.log("  Shiprocket order_id:", stdCreated.shiprocketOrderId);
  console.log("  shipment_id:", stdCreated.shipmentId || stdCreated.data?.shipment_id);
  console.log("  channel_order_id:", stdCreated.data?.channel_order_id || stdOrderId);
  console.log("  → Check Orders in Shiprocket panel for:", stdOrderId);

  if (stdCreated.shipmentId && stdPick) {
    const courierId = stdPick.courier_company_id || stdPick.id;
    console.log("\n[4b] Assign AWB (standard) courier", courierId, "…");
    const awb = await shiprocket.assignAwb(stdCreated.shipmentId, courierId);
    if (awb.success) {
      console.log("OK: AWB:", awb.awbNumber || "(see panel)");
    } else {
      console.warn("WARN: standard AWB assign:", awb.error);
    }
  }

  // ─── 5) Create QUICK hyperlocal order ───
  let quickCreated = null;
  if (quickPick) {
    const quickOrderId = "SMOKE-QCK-" + Date.now();
    console.log("\n[5] Create QUICK hyperlocal order", quickOrderId, "…");
    quickCreated = await shiprocket.createShiprocketOrder({
      orderId: quickOrderId,
      pickupLocation: pickup,
      billingCustomerName: "Smoke Quick",
      billingAddress: "Near Chandni Chowk Market Gate",
      billingCity: "Delhi",
      billingPincode: "110006",
      billingState: "Delhi",
      billingEmail: process.env.SHIPROCKET_EMAIL || "smoke@example.com",
      billingPhone: "9876543210",
      paymentMethod: "Prepaid",
      shippingMode: "quick",
      deliveryLat: dropLat,
      deliveryLong: dropLong,
      subtotal: 149,
      weight: 0.5,
      shippingCharges: Number(
        quickPick.rate || quickPick.rates || quickPick.freight_charge || 0
      ),
      items: [
        {
          name: "Smoke Quick Mithai",
          sku: "SMOKE-QCK-1",
          quantity: 1,
          price: 149,
          discount: 0,
          tax: 0,
        },
      ],
    });

    if (!quickCreated.success) {
      console.error("FAIL: Quick create:", quickCreated.error);
      console.error(JSON.stringify(quickCreated.data || {}, null, 2));
      // Don't exit — standard already proved panel create works
    } else {
      createdIds.push(quickCreated.shiprocketOrderId);
      console.log("OK: QUICK created");
      console.log("  Shiprocket order_id:", quickCreated.shiprocketOrderId);
      console.log(
        "  shipment_id:",
        quickCreated.shipmentId || quickCreated.data?.shipment_id
      );
      console.log(
        "  channel_order_id:",
        quickCreated.data?.channel_order_id || quickOrderId
      );
      console.log("  lat/long:", dropLat, dropLong);
      console.log("  → Check Orders in Shiprocket panel for:", quickOrderId);

      const qShipment =
        quickCreated.shipmentId || quickCreated.data?.shipment_id;
      const qCourierId = quickPick.courier_company_id || quickPick.id;
      if (qShipment) {
        console.log(
          "\n[5b] Assign AWB (Quick)",
          qCourierId ? "courier " + qCourierId : "(auto)",
          "…"
        );
        const qAwb = await shiprocket.assignAwb(qShipment, qCourierId);
        if (qAwb.success) {
          console.log("OK: Quick AWB:", qAwb.awbNumber || "(see panel)");
          console.log(
            "  assign response keys:",
            Object.keys(qAwb.data || {}).join(", ")
          );
        } else {
          console.warn("WARN: Quick AWB assign:", qAwb.error);
          console.warn(JSON.stringify(qAwb.data || {}, null, 2));
        }
      }
    }
  } else {
    console.log("\n[5] SKIP Quick create — no Quick courier available");
  }

  // ─── 6) Fetch details (what panel shows) ───
  console.log("\n[6] Fetch order details from Shiprocket API…");
  for (const id of createdIds) {
    const details = await shiprocket.getShipmentDetails(id);
    if (!details.success) {
      console.warn("WARN: show", id, details.error);
      continue;
    }
    const d = details.data?.data || details.data || {};
    console.log("── Order", id, "──");
    console.log("  status:", d.status || d.status_code || d.shipments?.[0]?.status);
    console.log("  channel_order_id:", d.channel_order_id || d.customer_details?.order_id);
    console.log(
      "  customer:",
      d.customer_name || d.customer_details?.first_name,
      d.customer_phone || d.customer_details?.phone
    );
    console.log(
      "  delivery:",
      d.customer_pincode || d.delivery_code,
      d.customer_city || d.delivery_city
    );
    console.log(
      "  awb:",
      d.awb || d.shipments?.[0]?.awb || d.awb_data?.awb || "(none yet)"
    );
    console.log(
      "  courier:",
      d.courier_name || d.shipments?.[0]?.courier || "(none yet)"
    );
  }

  // ─── 7) Cancel demos (unless KEEP_ORDERS=1) ───
  if (!keepOrders) {
    console.log("\n[7] Cancel demo orders…");
    for (const id of createdIds) {
      const cancelled = await shiprocket.cancelShiprocketOrder(id);
      if (cancelled.success) {
        console.log("OK: cancelled", id);
      } else {
        console.warn("WARN: cancel failed for", id, "—", cancelled.error);
        console.warn("  Cancel manually in Shiprocket panel.");
      }
    }
  } else {
    console.log("\n[7] KEEP_ORDERS=1 — leaving orders in panel (cancel manually).");
  }

  console.log("\n=== FULL SMOKE SUMMARY ===");
  console.log("Auth:              OK");
  console.log("Standard rates:    OK (" + stdCouriers.length + " couriers)");
  console.log(
    "Quick rates:       " +
      (quickRate.success
        ? "OK (" + listCouriers(quickRate.data).length + " couriers)"
        : "FAIL — " + quickRate.error)
  );
  console.log(
    "Standard create:   OK → SR#" + stdCreated.shiprocketOrderId + " / " + stdOrderId
  );
  console.log(
    "Quick create:      " +
      (quickCreated?.success
        ? "OK → SR#" + quickCreated.shiprocketOrderId
        : quickPick
          ? "FAIL"
          : "SKIPPED (no courier)")
  );
  console.log(
    "\nOpen Shiprocket panel → Orders and search for SMOKE-STD- / SMOKE-QCK-"
  );
  if (!keepOrders) {
    console.log("(Demos were cancelled; they may still appear as Cancelled.)");
    console.log("Re-run with KEEP_ORDERS=1 to leave them New/Open in the panel.");
  }
  console.log("\n=== SMOKE PASSED ===");
}

main().catch((err) => {
  console.error("Unexpected error:", err?.message || err);
  process.exit(1);
});
