const shiprocket = require("../../services/shiprocket");

function makeUniqueSkuFactory() {
  const skuCountMap = new Map();
  return (base) => {
    const key = String(base || "SKU-ITEM");
    const count = (skuCountMap.get(key) || 0) + 1;
    skuCountMap.set(key, count);
    return count === 1 ? key : `${key}-${count}`;
  };
}

function boxDimensionsForWeight(billedW) {
  if (billedW <= 1) return { length: 10, breadth: 10, height: 6 };
  if (billedW <= 2) return { length: 15, breadth: 15, height: 10 };
  if (billedW <= 3) return { length: 18, breadth: 18, height: 10 };
  if (billedW <= 4) return { length: 20, breadth: 20, height: 12 };
  return { length: 24, breadth: 20, height: 15 };
}

function buildCreatePayload(order, userEmail, mode, orderIdOverride) {
  const makeUniqueSku = makeUniqueSkuFactory();
  const billedW = Number(order.weight) || 0.5;
  const box = boxDimensionsForWeight(billedW);
  const paymentMethod =
    order.paymentMethod === "cod" ? "COD" : "Prepaid";

  return {
    orderId: orderIdOverride || order.orderId,
    billingCustomerName: order.address?.name || "Customer",
    billingEmail: userEmail || "customer@example.com",
    billingPhone: order.address?.phone || "9999999999",
    billingAddress: order.address?.address || "Address not provided",
    billingCity: order.address?.city || "Delhi",
    billingPincode: order.address?.pincode || "110006",
    billingState: order.address?.state || "Delhi",
    billingCountry: "India",
    paymentMethod,
    subtotal: Number(order.subtotal) || 0,
    weight: billedW,
    shippingCharges: Number(order.shiprocketFee) || 0,
    transactionCharges: Number(order.convenienceFee || 0) * 1.18,
    shippingMode: mode,
    deliveryLat: order.deliveryLat,
    deliveryLong: order.deliveryLong,
    ...box,
    items: (order.items || []).map((item) => ({
      name: item.name || "Product",
      sku: makeUniqueSku(item.itemId || item.name),
      quantity: item.quantity,
      price: item.price,
      tax: item.tax,
      discount: item.discount,
    })),
  };
}

async function tryCreateAndAssign(order, userEmail, mode, orderIdOverride) {
  const payload = buildCreatePayload(order, userEmail, mode, orderIdOverride);
  const created = await shiprocket.createShiprocketOrder(payload);
  if (!created.success) {
    return { success: false, error: created.error, data: created.data, mode };
  }

  let awbNumber = null;
  const shipmentId = created.shipmentId;
  const courierId = order.courierCompanyId;

  if (shipmentId && (mode === "quick" || courierId)) {
    const assigned = await shiprocket.assignAwb(shipmentId, courierId);
    if (assigned.success) {
      awbNumber = assigned.awbNumber || null;
    } else if (mode === "quick") {
      // Quick without AWB is still a created order; surface assign error but keep success
      console.warn(
        `[SHIPROCKET] AWB assign failed for ${order.orderId}:`,
        assigned.error
      );
    }
  }

  return {
    success: true,
    mode,
    shiprocketOrderId: created.shiprocketOrderId,
    shipmentId: shipmentId || null,
    awbNumber,
    data: created.data,
  };
}

/**
 * Create Shiprocket shipment for an order.
 * If requested mode is quick and it fails, falls back to standard.
 * Mutates and saves the order document.
 *
 * @param {import("mongoose").Document} order
 * @param {{ email?: string, forceOrderIdSuffix?: boolean }} [opts]
 */
async function createShipmentForOrder(order, opts = {}) {
  const requested =
    order.requestedShippingMode === "quick" || order.shippingMode === "quick"
      ? "quick"
      : "standard";

  order.requestedShippingMode = requested;
  order.isLocalShiprocket = false;

  const userEmail = opts.email;
  let orderIdOverride = order.orderId;
  if (opts.forceOrderIdSuffix) {
    const uniqueSuffix =
      Date.now().toString().slice(-4) + Math.floor(Math.random() * 100);
    orderIdOverride = `${order.orderId}-${uniqueSuffix}`;
  }

  if (requested === "quick") {
    let lat = Number(order.deliveryLat);
    let long = Number(order.deliveryLong);
    if (!Number.isFinite(lat) || !Number.isFinite(long)) {
      const { getPincodeCoords } = require("./pincodeCoords");
      const fromPin = getPincodeCoords(order.address?.pincode);
      if (fromPin) {
        lat = fromPin.lat;
        long = fromPin.long;
        order.deliveryLat = lat;
        order.deliveryLong = long;
      }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(long)) {
      console.warn(
        `[SHIPROCKET] Quick requested for ${order.orderId} but coords missing — falling back to standard`
      );
    } else {
      const quickResult = await tryCreateAndAssign(
        order,
        userEmail,
        "quick",
        orderIdOverride
      );
      if (quickResult.success) {
        order.shippingMode = "quick";
        order.shippingFallbackUsed = false;
        order.shiprocketOrderId = String(quickResult.shiprocketOrderId);
        if (quickResult.awbNumber) order.awbNumber = String(quickResult.awbNumber);
        order.shipmentStatus = "created";
        order.shiprocketError = null;
        order.shiprocketAt = new Date();
        await order.save();
        return {
          success: true,
          shippingMode: "quick",
          shippingFallbackUsed: false,
          shiprocketOrderId: order.shiprocketOrderId,
          awbNumber: order.awbNumber || null,
        };
      }
      console.warn(
        `[SHIPROCKET] Quick failed for ${order.orderId}: ${quickResult.error} — falling back to standard`
      );
      order.shiprocketError = `Quick failed: ${quickResult.error || "unknown"}; trying standard`;
    }

    // Fallback to standard (new Shiprocket order id suffix to avoid duplicate)
    const stdOverride = `${order.orderId}-std-${Date.now().toString().slice(-6)}`;
    const stdResult = await tryCreateAndAssign(
      order,
      userEmail,
      "standard",
      stdOverride
    );
    if (stdResult.success) {
      order.shippingMode = "standard";
      order.shippingFallbackUsed = true;
      order.shiprocketOrderId = String(stdResult.shiprocketOrderId);
      if (stdResult.awbNumber) order.awbNumber = String(stdResult.awbNumber);
      order.shipmentStatus = "created";
      order.shiprocketError = order.shiprocketError
        ? `${order.shiprocketError}; shipped via standard fallback`
        : "Shipped via standard fallback after Quick failure";
      order.shiprocketAt = new Date();
      await order.save();
      return {
        success: true,
        shippingMode: "standard",
        shippingFallbackUsed: true,
        shiprocketOrderId: order.shiprocketOrderId,
        awbNumber: order.awbNumber || null,
      };
    }

    order.shippingMode = "standard";
    order.shippingFallbackUsed = true;
    order.shipmentStatus = "failed";
    order.shiprocketError = `Quick and standard failed: ${stdResult.error || "unknown"}`;
    await order.save();
    return {
      success: false,
      error: order.shiprocketError,
      shippingFallbackUsed: true,
    };
  }

  // Standard path
  const stdResult = await tryCreateAndAssign(
    order,
    userEmail,
    "standard",
    orderIdOverride
  );
  if (stdResult.success) {
    order.shippingMode = "standard";
    order.shippingFallbackUsed = false;
    order.shiprocketOrderId = String(stdResult.shiprocketOrderId);
    if (stdResult.awbNumber) order.awbNumber = String(stdResult.awbNumber);
    order.shipmentStatus = "created";
    order.shiprocketError = null;
    order.shiprocketAt = new Date();
    await order.save();
    return {
      success: true,
      shippingMode: "standard",
      shippingFallbackUsed: false,
      shiprocketOrderId: order.shiprocketOrderId,
      awbNumber: order.awbNumber || null,
    };
  }

  order.shippingMode = "standard";
  order.shippingFallbackUsed = false;
  order.shipmentStatus = "failed";
  order.shiprocketError = stdResult.error || "Shiprocket create failed";
  await order.save();
  return {
    success: false,
    error: order.shiprocketError,
    shippingFallbackUsed: false,
  };
}

module.exports = {
  createShipmentForOrder,
  buildCreatePayload,
};
