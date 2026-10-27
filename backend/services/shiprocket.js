const axios = require("axios");

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";
const DEFAULT_PICKUP_POSTCODE = "110006";

let cachedToken = null;
let tokenExpiresAt = 0;
let lastAuthError = null;

function getPickupLocation(orderData = {}) {
  return (
    orderData.pickupLocation ||
    process.env.SHIPROCKET_PICKUP_LOCATION ||
    "Primary"
  );
}

function getPickupPostcode() {
  return process.env.SHIPROCKET_PICKUP_POSTCODE || DEFAULT_PICKUP_POSTCODE;
}

function getPickupCoords() {
  const lat = Number(process.env.SHIPROCKET_PICKUP_LAT);
  const long = Number(process.env.SHIPROCKET_PICKUP_LONG);
  if (!Number.isFinite(lat) || !Number.isFinite(long)) {
    return null;
  }
  return { lat, long };
}

function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

async function getShiprocketToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    lastAuthError =
      "Missing SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD in backend .env";
    console.warn("[SHIPROCKET]", lastAuthError);
    return null;
  }

  try {
    const response = await axios.post(`${SHIPROCKET_BASE}/auth/login`, {
      email,
      password,
    });

    cachedToken = response.data?.token || null;
    tokenExpiresAt = now + 9 * 24 * 60 * 60 * 1000;
    lastAuthError = null;
    return cachedToken;
  } catch (error) {
    const status = error.response?.status;
    const apiMsg =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    clearTokenCache();
    if (status === 403) {
      lastAuthError =
        "Shiprocket Access forbidden (403). Use a dedicated API user from Settings → API (not the panel login), enable Orders/Courier modules, then update SHIPROCKET_EMAIL/PASSWORD.";
    } else {
      lastAuthError = `Shiprocket auth failed${status ? ` (${status})` : ""}: ${apiMsg}`;
    }
    console.error("[SHIPROCKET] Auth failed:", error.response?.data || error.message);
    return null;
  }
}

async function shiprocketRequest(method, path, data) {
  const token = await getShiprocketToken();
  if (!token) {
    return {
      success: false,
      error: lastAuthError || "Shiprocket authentication failed",
    };
  }

  try {
    const response = await axios({
      method,
      url: `${SHIPROCKET_BASE}${path}`,
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    const errPayload = error.response?.data || error.message;
    console.error(`[SHIPROCKET] ${method.toUpperCase()} ${path} failed:`, errPayload);
    return {
      success: false,
      error:
        typeof errPayload === "string"
          ? errPayload
          : errPayload?.message || JSON.stringify(errPayload),
      data: error.response?.data,
    };
  }
}

function normalizeItems(orderData) {
  const items = Array.isArray(orderData?.items)
    ? orderData.items
    : Array.isArray(orderData?.order_items)
      ? orderData.order_items
      : [];

  return items.map((item, index) => ({
    name: item.name || `Item ${index + 1}`,
    sku: String(item.sku || item.itemId || `SKU-${index + 1}`),
    units: Number(item.quantity || item.units || 1),
    selling_price: Number(item.price || item.selling_price || 0),
    discount: Number(item.discount || 0),
    tax: Number(item.tax || 0),
    hsn: item.hsn || undefined,
  }));
}

function extractIdsFromCreateResponse(data = {}) {
  const shiprocketOrderId =
    data.order_id ||
    data?.data?.order_id ||
    null;
  const shipmentId =
    data.shipment_id ||
    data?.data?.shipment_id ||
    null;
  return { shiprocketOrderId, shipmentId };
}

async function createShiprocketOrder(orderData = {}) {
  const orderItems = normalizeItems(orderData);
  if (!orderItems.length) {
    return { success: false, error: "Order items are required" };
  }

  const billingName =
    orderData.billingCustomerName ||
    orderData.billing_customer_name ||
    "Customer";
  const nameParts = String(billingName).trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || firstName;
  const isQuick =
    orderData.shippingMode === "quick" ||
    orderData.isHyperlocal === true ||
    orderData.is_new_hyperlocal === 1 ||
    orderData.is_new_hyperlocal === true;

  const deliveryLat = Number(
    orderData.deliveryLat ?? orderData.lat ?? orderData.billing_lat
  );
  const deliveryLong = Number(
    orderData.deliveryLong ?? orderData.long ?? orderData.billing_long
  );

  const payload = {
    order_id: String(orderData.orderId || orderData.order_id || Date.now()),
    order_date:
      orderData.orderDate ||
      new Date().toISOString().slice(0, 19).replace("T", " "),
    pickup_location: getPickupLocation(orderData),
    channel_id: process.env.SHIPROCKET_CHANNEL_ID || undefined,
    billing_customer_name: firstName,
    billing_last_name: lastName,
    billing_address:
      orderData.billingAddress || orderData.billing_address || "Address",
    billing_address_2:
      orderData.billingAddress2 || orderData.billing_address_2 || undefined,
    billing_city: orderData.billingCity || orderData.billing_city || "City",
    billing_pincode: String(
      orderData.billingPincode || orderData.billing_pincode || ""
    ),
    billing_state: orderData.billingState || orderData.billing_state || "State",
    billing_country: orderData.billingCountry || "India",
    billing_email: orderData.billingEmail || orderData.billing_email || "",
    billing_phone: String(
      orderData.billingPhone || orderData.billing_phone || ""
    ),
    shipping_is_billing: true,
    order_items: orderItems,
    payment_method:
      orderData.paymentMethod || orderData.payment_method || "Prepaid",
    sub_total: Number(orderData.subtotal || orderData.sub_total || 0),
    length: Number(orderData.length || 10),
    breadth: Number(orderData.breadth || 10),
    height: Number(orderData.height || 10),
    weight: Number(orderData.weight || 0.5),
    shipping_charges: Number(orderData.shippingCharges || 0),
    total_discount: Number(orderData.totalDiscount || 0),
  };

  if (isQuick) {
    payload.is_new_hyperlocal = 1;
    if (Number.isFinite(deliveryLat) && Number.isFinite(deliveryLong)) {
      payload.billing_lat = deliveryLat;
      payload.billing_long = deliveryLong;
      payload.shipping_lat = deliveryLat;
      payload.shipping_long = deliveryLong;
    }
  }

  const result = await shiprocketRequest("post", "/orders/create/adhoc", payload);
  if (!result.success) {
    return {
      ...result,
      error: result.error || lastAuthError || "Shiprocket create failed",
    };
  }

  const data = result.data || {};
  const bodyMsg = String(data.message || "");
  const { shiprocketOrderId, shipmentId } = extractIdsFromCreateResponse(data);
  const looksLikeError =
    /wrong pickup|invalid|does not exist|failed|error/i.test(bodyMsg) &&
    !shiprocketOrderId &&
    !shipmentId;

  if (looksLikeError || (!shiprocketOrderId && !shipmentId)) {
    return {
      success: false,
      error: bodyMsg || "Shiprocket create returned no order id",
      data,
    };
  }

  return {
    success: true,
    shiprocketOrderId: shiprocketOrderId || shipmentId,
    shipmentId: shipmentId || null,
    data,
  };
}

/**
 * @param {string|number} pickupPostcode
 * @param {string|number} deliveryPostcode
 * @param {number} weight
 * @param {number} [_orderValue]
 * @param {object} [options]
 * @param {"quick"|"standard"} [options.mode]
 * @param {number} [options.lat] customer lat (quick)
 * @param {number} [options.long] customer long (quick)
 * @param {number} [options.cod] 1 COD / 0 prepaid
 */
async function getShippingRate(
  pickupPostcode,
  deliveryPostcode,
  weight = 1,
  _orderValue = 0,
  options = {}
) {
  const token = await getShiprocketToken();
  if (!token) {
    return {
      success: false,
      error: lastAuthError || "Shiprocket authentication failed",
    };
  }

  const mode = options.mode === "quick" ? "quick" : "standard";
  // Quick (hyperlocal) on this account is prepaid-only; COD returns no serviceability
  const cod =
    mode === "quick"
      ? options.cod === 1 || options.cod === true
        ? 1
        : 0
      : options.cod === 0 || options.cod === false
        ? 0
        : 1;
  const pickup = pickupPostcode || getPickupPostcode();

  try {
    const params = new URLSearchParams({
      pickup_postcode: String(pickup),
      delivery_postcode: String(deliveryPostcode),
      weight: String(weight),
      cod: String(cod),
    });

    if (mode === "quick") {
      const shop = getPickupCoords();
      const latTo = Number(options.lat);
      const longTo = Number(options.long);
      if (!shop) {
        return {
          success: false,
          error:
            "Missing SHIPROCKET_PICKUP_LAT / SHIPROCKET_PICKUP_LONG in backend .env",
        };
      }
      if (!Number.isFinite(latTo) || !Number.isFinite(longTo)) {
        return {
          success: false,
          error: "Customer lat/long are required for Quick delivery rates",
        };
      }
      params.set("is_new_hyperlocal", "1");
      params.set("lat_from", String(shop.lat));
      params.set("long_from", String(shop.long));
      params.set("lat_to", String(latTo));
      params.set("long_to", String(longTo));
    }

    const url = `${SHIPROCKET_BASE}/courier/serviceability/?${params.toString()}`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const normalized = normalizeServiceabilityResponse(response.data, mode);
    if (
      mode === "quick" &&
      normalized.status === false &&
      !normalized.data?.available_courier_companies?.length
    ) {
      return {
        success: false,
        error: normalized.message || "No Quick serviceability found",
        data: normalized,
        mode,
      };
    }
    return { success: true, data: normalized, mode };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      data: error.response?.data,
      mode,
    };
  }
}

/**
 * Standard: { data: { available_courier_companies: [...] } }
 * Quick:    { status: true, data: [ { courier_name, rates, etd_hours, ... } ] }
 */
function normalizeServiceabilityResponse(raw, mode) {
  if (!raw || typeof raw !== "object") return raw;

  if (mode === "quick" && Array.isArray(raw.data)) {
    const companies = raw.data.map((c, index) => ({
      ...c,
      courier_name: c.courier_name || "Shiprocket Quick",
      courier_company_id: c.courier_company_id || c.id || c.courier_id || null,
      rate: Number(c.rate ?? c.rates ?? c.freight_charge ?? 0),
      freight_charge: Number(c.freight_charge ?? c.rates ?? c.rate ?? 0),
      etd_hours: c.etd_hours,
      estimated_delivery_days:
        c.estimated_delivery_days ??
        (c.etd_hours != null ? Number(c.etd_hours) / 24 : undefined),
      is_surface: false,
      mode: 1,
      _quickIndex: index,
    }));
    return {
      ...raw,
      data: {
        available_courier_companies: companies,
        available_courier_companies_vg: companies,
      },
      available_courier_companies: companies,
    };
  }

  // If Quick returned status:false
  if (mode === "quick" && raw.status === false) {
    return {
      ...raw,
      data: { available_courier_companies: [] },
      available_courier_companies: [],
    };
  }

  return raw;
}

async function assignAwb(shipmentId, courierId) {
  if (!shipmentId) {
    return { success: false, error: "shipmentId is required to assign AWB" };
  }
  const payload = {
    shipment_id: Number(shipmentId),
  };
  if (courierId != null && courierId !== "") {
    payload.courier_id = Number(courierId);
  }

  const result = await shiprocketRequest(
    "post",
    "/courier/assign/awb",
    payload
  );
  if (!result.success) return result;

  const data = result.data || {};
  const awb =
    data.awb_code ||
    data?.response?.data?.awb_code ||
    data?.data?.awb_code ||
    null;

  return {
    success: true,
    awbNumber: awb,
    data,
  };
}

async function trackShipment(trackingId) {
  return shiprocketRequest(
    "get",
    `/courier/track/awb/${encodeURIComponent(trackingId)}`
  );
}

async function generateLabel(shiprocketOrderIds = []) {
  const result = await shiprocketRequest("post", "/courier/generate/label", {
    shipment_id: shiprocketOrderIds,
  });
  if (!result.success) return result;
  return {
    success: true,
    labelUrl: result.data?.label_url || result.data?.label_url,
    data: result.data,
  };
}

async function cancelShiprocketOrder(shiprocketOrderId) {
  return shiprocketRequest("post", "/orders/cancel", {
    ids: [Number(shiprocketOrderId)],
  });
}

async function getShipmentDetails(shiprocketOrderId) {
  return shiprocketRequest("get", `/orders/show/${shiprocketOrderId}`);
}

module.exports = {
  getShiprocketToken,
  createShiprocketOrder,
  getShippingRate,
  assignAwb,
  trackShipment,
  generateLabel,
  cancelShiprocketOrder,
  getShipmentDetails,
  clearTokenCache,
  getPickupPostcode,
  getPickupCoords,
  normalizeServiceabilityResponse,
  getLastAuthError: () => lastAuthError,
};
