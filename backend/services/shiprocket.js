const axios = require("axios");

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";

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

  const result = await shiprocketRequest("post", "/orders/create/adhoc", payload);
  if (!result.success) {
    return {
      ...result,
      error: result.error || lastAuthError || "Shiprocket create failed",
    };
  }

  const data = result.data || {};
  // Shiprocket sometimes returns HTTP 200 with an error message in the body
  const bodyMsg = String(data.message || "");
  const looksLikeError =
    /wrong pickup|invalid|does not exist|failed|error/i.test(bodyMsg) &&
    !data.order_id &&
    !data.shipment_id;

  const shiprocketOrderId =
    data.order_id ||
    data.shipment_id ||
    data?.data?.order_id ||
    data?.data?.shipment_id ||
    null;

  if (looksLikeError || !shiprocketOrderId) {
    return {
      success: false,
      error: bodyMsg || "Shiprocket create returned no order id",
      data,
    };
  }

  return {
    success: true,
    shiprocketOrderId,
    data,
  };
}

async function getShippingRate(
  pickupPostcode,
  deliveryPostcode,
  weight = 1,
  _orderValue = 0
) {
  const token = await getShiprocketToken();
  if (!token) {
    return {
      success: false,
      error: lastAuthError || "Shiprocket authentication failed",
    };
  }

  try {
    const url = `${SHIPROCKET_BASE}/courier/serviceability/?pickup_postcode=${pickupPostcode}&delivery_postcode=${deliveryPostcode}&weight=${weight}&cod=1`;
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      data: error.response?.data,
    };
  }
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
  trackShipment,
  generateLabel,
  cancelShiprocketOrder,
  getShipmentDetails,
  clearTokenCache,
  getLastAuthError: () => lastAuthError,
};
