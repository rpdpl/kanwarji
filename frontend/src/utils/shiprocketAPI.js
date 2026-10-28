import { apiGet, apiPost } from './axiosInstance.jsx';

// Shiprocket API utility functions

/**
 * Create a Shiprocket order
 * @param {string} orderId - Internal order ID
 * @param {Object} orderData - Order data for Shiprocket
 * @returns {Promise<Object>} - API response
 */
export const createShiprocketOrder = async (orderId, orderData) => {
  try {
    const response = await apiPost('/api/shiprocket/create-order', {
      orderId,
      ...orderData
    });
    return response.data;
  } catch (error) {
    console.error('Error creating Shiprocket order:', error);
    throw error;
  }
};

/**
 * Get shipping rates for a delivery
 * @param {string} pickupLocationId - Pickup location ID / postcode
 * @param {string} deliveryPincode - Delivery pincode
 * @param {number} weight - Weight in kg
 * @param {number} orderValue - Order value
 * @param {{ mode?: 'quick'|'standard', lat?: number, long?: number, cod?: number }} [options]
 * @returns {Promise<Object>} - Shipping rates
 */
export const getShippingRates = async (
  pickupLocationId,
  deliveryPincode,
  weight = 1,
  orderValue = 0,
  options = {}
) => {
  try {
    const mode = options.mode === "quick" ? "quick" : "standard";
    const body = {
      pickupLocationId,
      deliveryPincode,
      weight,
      orderValue,
      mode,
    };
    if (mode === "quick") {
      body.lat = options.lat;
      body.long = options.long;
    }
    // Instamojo checkout is prepaid-only — always quote prepaid rates unless COD is explicit
    body.cod = options.cod === 1 || options.cod === true ? 1 : 0;

    const response = await apiPost('/api/shiprocket/shipping-rates', body);
    const data = response.data || {};
    // Build a unified list of couriers from various possible locations in the payload
    const collect = [];
    const pushAll = (arr) => {
      if (Array.isArray(arr)) collect.push(...arr);
    };
    pushAll(data.couriers);
    if (data.data) {
      pushAll(data.data.couriers);
      pushAll(data.data.available_courier_companies);
    }
    pushAll(data.available_courier_companies);
    // nested Shiprocket shape: { success, data: { data: { available_courier_companies } } }
    if (data.data?.data) {
      pushAll(data.data.data.available_courier_companies);
    }
    // De-duplicate by courier_company_id + id
    const seen = new Set();
    const unified = collect.filter((c) => {
      const key = `${c?.courier_company_id || ''}-${c?.id || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Standard: show Air/Express and Surface (client request). Quick list is already hyperlocal-only.
    const list = unified;
    // Expose normalized list for consumers
    data.available_courier_companies_vg = list;
    if (data.data) {
      data.data.available_courier_companies_vg = list;
    }
    data.mode = data.mode || mode;
    return data;
  } catch (error) {
    console.error('Error fetching shipping rates:', error);
    throw error;
  }
};

/**
 * Track shipment using tracking ID
 * @param {string} trackingId - AWB/tracking number
 * @returns {Promise<Object>} - Tracking information
 */
export const trackShipment = async (trackingId) => {
  try {
    const response = await apiGet(`/api/shiprocket/track/${trackingId}`);
    return response.data;
  } catch (error) {
    console.error('Error tracking shipment:', error);
    throw error;
  }
};

/**
 * Generate shipping label
 * @param {Array<string>} shiprocketOrderIds - Array of Shiprocket order IDs
 * @returns {Promise<Object>} - Label generation response
 */
export const generateLabel = async (shiprocketOrderIds) => {
  try {
    const response = await apiPost('/api/shiprocket/generate-label', {
      shiprocketOrderIds
    });
    return response.data;
  } catch (error) {
    console.error('Error generating label:', error);
    throw error;
  }
};

/**
 * Cancel Shiprocket order
 * @param {string} shiprocketOrderId - Shiprocket order ID to cancel
 * @returns {Promise<Object>} - Cancellation response
 */
export const cancelShiprocketOrder = async (shiprocketOrderId) => {
  try {
    const response = await apiPost('/api/shiprocket/cancel-order', {
      shiprocketOrderId
    });
    return response.data;
  } catch (error) {
    console.error('Error cancelling Shiprocket order:', error);
    throw error;
  }
};

/**
 * Get shipment details
 * @param {string} shiprocketOrderId - Shiprocket order ID
 * @returns {Promise<Object>} - Shipment details
 */
export const getShipmentDetails = async (shiprocketOrderId) => {
  try {
    const response = await apiGet(`/api/shiprocket/shipment/${shiprocketOrderId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching shipment details:', error);
    throw error;
  }
};

/**
 * Get tracking URL for Shiprocket
 * @param {string} awbNumber - AWB number
 * @returns {string} - Tracking URL
 */
export const getTrackingUrl = (awbNumber) => {
  return `https://shiprocket.co/tracking/${awbNumber}`;
};

// Constants for Shiprocket integration
export const SHIPROCKET_PICKUP_LOCATION_ID = "110006";

// Delhi/NCR pincodes eligible for Quick (Hyperlocal) delivery option
export const QUICK_ELIGIBLE_PINCODES = new Set([
  // Delhi
  "110001", "110002", "110003", "110004", "110005", "110006", "110007", "110008", "110009", "110010",
  "110011", "110012", "110013", "110014", "110015", "110016", "110017", "110018", "110019", "110020",
  "110021", "110022", "110023", "110024", "110025", "110026", "110027", "110028", "110029", "110030",
  "110031", "110032", "110033", "110034", "110035", "110036", "110037", "110038", "110039", "110040",
  "110041", "110042", "110043", "110044", "110045", "110046", "110047", "110048", "110049", "110051",
  "110052", "110053", "110054", "110055", "110056", "110057", "110058", "110059", "110060", "110061",
  "110062", "110063", "110064", "110065", "110066", "110067", "110068", "110070", "110071", "110073",
  "110074", "110075", "110076", "110078", "110081", "110082", "110083", "110084", "110085", "110086",
  "110087", "110088", "110091", "110092", "110093", "110094", "110095", "110096",
  // Ghaziabad / Noida
  "201001", "201003", "201004", "201005", "201006", "201007", "201009", "201010", "201011", "201012",
  "201013", "201102", "201201", "201204", "201206", "201301", "201302",
  // Hapur
  "245101", "245201", "245205", "245207", "245208", "245301", "245304",
  // Faridabad / Palwal / Nuh
  "121001", "121002", "121004", "121005", "121006", "121007", "121008", "121009", "121010", "121011",
  "121101", "121102", "121103", "121104", "121105", "121106", "121107",
  // Gurugram / Nuh / Rewari
  "122001", "122002", "122003", "122006", "122008", "122009", "122010", "122011", "122015", "122016",
  "122017", "122018", "122051", "122101", "122102", "122103", "122104", "122105", "122106", "122107",
  "122108",
  "123003", "123413", "123414", "123502", "123504", "123505", "123506",
]);

/** @deprecated use QUICK_ELIGIBLE_PINCODES — kept for older imports */
export const FREE_SHIPPING_PINCODES = QUICK_ELIGIBLE_PINCODES;

/**
 * Calculate billed weight for shipping
 * @param {number} weightKg - Weight in kg
 * @returns {number} - Billed weight in kg
 */
export const calculateBilledWeight = (weightKg) => {
  const w = Number(weightKg) || 0;
  if (w <= 0) return 0;
  if (w <= 0.25) return 0.5; // 1–250 g → 0.5 kg
  if (w <= 0.75) return 1;   // 251–750 g → 1.0 kg
  // For weights > 0.75 kg:
  // If w <= k + 0.75, charge k + 1; else charge k + 2, where k = floor(w)
  const k = Math.floor(w);
  if (w <= k + 0.75) return k + 1; // e.g., 0.76–1.75 → 2.0 kg; 1.00–1.75 → 2.0 kg
  return k + 2;                    // e.g., 1.76–2.75 → 3.0 kg; and so forth
};
