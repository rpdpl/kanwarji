// Shiprocket API utility functions for Admin Panel

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface ShippingRateData {
  available_courier_companies_vg?: Array<{
    courier_name: string;
    rate: number;
    etd: string;
  }>;
}

interface TrackingData {
  tracking_data?: {
    shipment_track: Array<{
      date: string;
      status: string;
      location: string;
      description: string;
    }>;
    shipment_status?: string;
  };
}

interface ShipmentDetails {
  shipment?: {
    order_id: string;
    shipment_id: string;
    awb_code: string;
    courier_name: string;
    status: string;
    pickup_date: string;
    delivered_date?: string;
    etd: string;
  };
}

/**
 * Create a Shiprocket order
 */
export const createShiprocketOrder = async (
  orderId: string,
  orderData: any,
  options?: { pickupLocation?: string; shippingIsBilling?: boolean }
): Promise<ApiResponse> => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/shiprocket/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        orderId,
        ...orderData,
        ...(options?.pickupLocation ? { pickupLocation: options.pickupLocation } : {}),
        ...(typeof options?.shippingIsBilling === 'boolean' ? { shippingIsBilling: options.shippingIsBilling } : {}),
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating Shiprocket order:', error);
    throw error;
  }
};

/**
 * Get shipping rates for a delivery
 */
export const getShippingRates = async (
  pickupLocationId: string,
  deliveryPincode: string,
  weight: number = 1,
  orderValue: number = 0
): Promise<ApiResponse<ShippingRateData>> => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/shiprocket/shipping-rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        pickupLocationId,
        deliveryPincode,
        weight,
        orderValue,
      }),
    });

    const data = await response.json();
    // Normalize courier list to a single Air-only array for admin consumers
    const collect: any[] = [];
    const pushAll = (arr: any[]) => { if (Array.isArray(arr)) collect.push(...arr); };
    pushAll((data as any)?.couriers);
    pushAll((data as any)?.available_courier_companies);
    if ((data as any)?.data) {
      pushAll((data as any).data.couriers);
      pushAll((data as any).data.available_courier_companies);
      pushAll((data as any).data.available_courier_companies_vg);
    }
    // Strict Air-only filter
    const airOnly = collect.filter((c) => Number(c?.mode) === 1 || c?.is_surface === false);
    (data as any).data = (data as any).data || {};
    (data as any).data.available_courier_companies_vg = airOnly;
    return data as ApiResponse<ShippingRateData>;
  } catch (error) {
    console.error('Error fetching shipping rates:', error);
    throw error;
  }
};

/**
 * Track shipment using tracking ID
 */
export const trackShipment = async (trackingId: string): Promise<ApiResponse<TrackingData>> => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/shiprocket/track/${trackingId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error tracking shipment:', error);
    throw error;
  }
};

/**
 * Generate shipping label
 */
export const generateLabel = async (shiprocketOrderIds: string[]): Promise<ApiResponse> => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/shiprocket/generate-label`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ shiprocketOrderIds }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error generating label:', error);
    throw error;
  }
};

/**
 * Cancel Shiprocket order
 */
export const cancelShiprocketOrder = async (shiprocketOrderId: string): Promise<ApiResponse> => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/shiprocket/cancel-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ shiprocketOrderId }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error cancelling Shiprocket order:', error);
    throw error;
  }
};

/**
 * Get shipment details
 */
export const getShipmentDetails = async (shiprocketOrderId: string): Promise<ApiResponse<ShipmentDetails>> => {
  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`${API_BASE_URL}/api/shiprocket/shipment/${shiprocketOrderId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching shipment details:', error);
    throw error;
  }
};

/**
 * Get tracking URL for Shiprocket
 */
export const getTrackingUrl = (awbNumber: string): string => {
  return `https://shiprocket.co/tracking/${awbNumber}`;
};

// Constants
export const SHIPROCKET_PICKUP_LOCATION_ID = "110006";

// Free shipping pincodes (same as server-side list)
export const FREE_SHIPPING_PINCODES = new Set([
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
  // Noida
  "201301", "201009", "201003", "201004", "201005", "201006", "201007", "201010", "201011", "201012",
  "201013", "201102", "201201", "201204", "201206", "201302",
  // Ghaziabad
  "245101", "245201", "245205", "245207", "245208", "245301", "245304",
  // Faridabad
  "121001", "121002", "121004", "121005", "121006", "121007", "121008", "121009", "121010", "121011",
  "121101", "121102", "121103", "121105", "121106", "121107",
  // Gurgaon
  "122001", "122002", "122003", "122006", "122008", "122009", "122010", "122011", "122015", "122016",
  "122017", "122018", "122051", "122101", "122102", "122103", "122104", "122105", "122106", "122107",
  // Meerut
  "123003", "123413", "123414", "123502", "123504", "123505", "123506",
]);

/**
 * Calculate billed weight for shipping
 */
export const calculateBilledWeight = (weightKg: number): number => {
  const w = Number(weightKg) || 0;
  if (w <= 0) return 0;
  if (w <= 0.25) return 0.5; // 1–250 g → 0.5 kg
  if (w <= 0.75) return 1;   // 251–750 g → 1.0 kg
  const k = Math.floor(w);
  if (w <= k + 0.75) return k + 1; // up to k+0.75 → charge k+1 kg
  return k + 2;                    // beyond k+0.75 → charge k+2 kg
};
