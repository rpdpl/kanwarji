const shiprocket = require("../../services/shiprocket");
const { formatShippingSummary } = require("./orderShippingSummary");
const { appendOrderThirdPartyLog } = require("./orderThirdPartyLog");
const { logger } = require("./logger");

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

  // Ops note for Shiprocket UI only when address line 2 is empty (do not overwrite real address_2)
  const existingAddr2 = String(
    order.address?.address2 || order.address?.address_2 || ""
  ).trim();
  const shippingNote = formatShippingSummary({ ...order, shippingMode: mode });
  const billingAddress2 = existingAddr2 || (shippingNote ? `Ship: ${shippingNote}` : undefined);

  return {
    orderId: orderIdOverride || order.orderId,
    billingCustomerName: order.address?.name || "Customer",
    billingEmail: userEmail || "customer@example.com",
    billingPhone: order.address?.phone || "9999999999",
    billingAddress: order.address?.address || "Address not provided",
    billingAddress2,
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

/**
 * Create order + assign AWB.
 * Quick mode never passes checkout courierCompanyId (that id is Instant Pickup / standard).
 * Quick without AWB is a failure (not success).
 */
async function tryCreateAndAssign(order, userEmail, mode, orderIdOverride) {
  const payload = buildCreatePayload(order, userEmail, mode, orderIdOverride);
  const created = await shiprocket.createShiprocketOrder(payload);
  if (!created.success) {
    appendOrderThirdPartyLog(order, {
      service: "shiprocket",
      action: `create_${mode}`,
      success: false,
      message: created.error || "create failed",
      statusCode: created.statusCode,
      response: created.data,
    });
    return { success: false, error: created.error, data: created.data, mode };
  }

  appendOrderThirdPartyLog(order, {
    service: "shiprocket",
    action: `create_${mode}`,
    success: true,
    message: `order=${created.shiprocketOrderId} shipment=${created.shipmentId}`,
    response: {
      shiprocketOrderId: created.shiprocketOrderId,
      shipmentId: created.shipmentId,
    },
  });

  let awbNumber = null;
  const shipmentId = created.shipmentId;
  // Instant Pickup / serviceability courier ids must NOT be used for Quick/hyperlocal AWB
  const courierId = mode === "quick" ? undefined : order.courierCompanyId;

  if (shipmentId && (mode === "quick" || courierId)) {
    const assigned = await shiprocket.assignAwb(shipmentId, courierId);
    if (assigned.success && assigned.awbNumber) {
      awbNumber = assigned.awbNumber;
      appendOrderThirdPartyLog(order, {
        service: "shiprocket",
        action: `assign_awb_${mode}`,
        success: true,
        message: `awb=${awbNumber}`,
        response: assigned.data,
      });
    } else {
      const awbErr =
        assigned.error || "AWB assign failed (wallet / courier / null id)";
      appendOrderThirdPartyLog(order, {
        service: "shiprocket",
        action: `assign_awb_${mode}`,
        success: false,
        message: awbErr,
        statusCode: assigned.statusCode,
        response: assigned.data,
      });

      if (mode === "quick") {
        // Order exists in Shiprocket but is not shippable — do not pretend success
        return {
          success: false,
          created: true,
          mode,
          shiprocketOrderId: created.shiprocketOrderId,
          shipmentId: shipmentId || null,
          awbNumber: null,
          error: awbErr,
          data: assigned.data || created.data,
        };
      }
      // Standard: create OK without AWB is still usable (manual assign in panel)
      logger.warn(
        { orderId: order.orderId, error: awbErr },
        "[SHIPROCKET] Standard AWB assign failed; order created without AWB"
      );
    }
  } else if (mode === "quick" && !shipmentId) {
    return {
      success: false,
      created: true,
      mode,
      shiprocketOrderId: created.shiprocketOrderId,
      shipmentId: null,
      error: "Quick create returned no shipment_id for AWB assign",
      data: created.data,
    };
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

function applyPartialQuickFailure(order, quickResult) {
  if (quickResult.shiprocketOrderId) {
    order.shiprocketOrderId = String(quickResult.shiprocketOrderId);
  }
  if (quickResult.shipmentId) {
    order.shiprocketShipmentId = String(quickResult.shipmentId);
  }
  order.shippingMode = "quick";
  order.shippingFallbackUsed = false;
  order.shipmentStatus = "failed";
  order.shiprocketError =
    quickResult.error || "Quick AWB assign failed after order create";
  order.shiprocketLastResponse = quickResult.data || undefined;
  order.shiprocketAt = new Date();
}

/**
 * Create Shiprocket shipment for an order.
 * If requested mode is quick and create itself fails, falls back to standard.
 * If quick create succeeds but AWB fails, does NOT fall back (avoids duplicate SR orders).
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
      logger.warn(
        { orderId: order.orderId },
        "[SHIPROCKET] Quick requested but coords missing — falling back to standard"
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
        if (quickResult.shipmentId) {
          order.shiprocketShipmentId = String(quickResult.shipmentId);
        }
        if (quickResult.awbNumber) order.awbNumber = String(quickResult.awbNumber);
        order.shipmentStatus = "created";
        order.shiprocketError = null;
        order.shiprocketLastResponse = undefined;
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

      // Create succeeded but AWB failed — persist failure; do not create a second (standard) order
      if (quickResult.created) {
        applyPartialQuickFailure(order, quickResult);
        await order.save();
        logger.error(
          {
            orderId: order.orderId,
            shiprocketOrderId: order.shiprocketOrderId,
            error: quickResult.error,
          },
          "[SHIPROCKET] Quick order created but AWB failed — recharge wallet / assign in panel; no standard fallback"
        );
        return {
          success: false,
          error: order.shiprocketError,
          shippingMode: "quick",
          shippingFallbackUsed: false,
          shiprocketOrderId: order.shiprocketOrderId || null,
          partial: true,
        };
      }

      logger.warn(
        { orderId: order.orderId, error: quickResult.error },
        "[SHIPROCKET] Quick create failed — falling back to standard"
      );
      order.shiprocketError = `Quick failed: ${quickResult.error || "unknown"}; trying standard`;
      order.shiprocketLastResponse = quickResult.data || undefined;
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
      if (stdResult.shipmentId) {
        order.shiprocketShipmentId = String(stdResult.shipmentId);
      }
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
    order.shiprocketLastResponse = stdResult.data || order.shiprocketLastResponse;
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
    if (stdResult.shipmentId) {
      order.shiprocketShipmentId = String(stdResult.shipmentId);
    }
    if (stdResult.awbNumber) order.awbNumber = String(stdResult.awbNumber);
    order.shipmentStatus = "created";
    order.shiprocketError = null;
    order.shiprocketLastResponse = undefined;
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
  order.shiprocketLastResponse = stdResult.data || undefined;
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
