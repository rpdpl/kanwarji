jest.mock("axios");

const axios = require("axios");

const SHIPROCKET_BASE = "https://apiv2.shiprocket.in/v1/external";

function loadShiprocket() {
  jest.resetModules();
  jest.doMock("axios", () => axios);
  return require("../../services/shiprocket");
}

describe("services/shiprocket (mocked axios)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    delete process.env.SHIPROCKET_EMAIL;
    delete process.env.SHIPROCKET_PASSWORD;
    delete process.env.SHIPROCKET_CHANNEL_ID;
    delete process.env.SHIPROCKET_PICKUP_LOCATION;
  });

  afterEach(() => {
    console.warn.mockRestore?.();
    console.error.mockRestore?.();
  });

  describe("getShiprocketToken", () => {
    it("returns null when credentials are missing", async () => {
      const shiprocket = loadShiprocket();
      await expect(shiprocket.getShiprocketToken()).resolves.toBeNull();
      expect(axios.post).not.toHaveBeenCalled();
    });

    it("logs in and returns token when credentials are set", async () => {
      process.env.SHIPROCKET_EMAIL = "shop@example.com";
      process.env.SHIPROCKET_PASSWORD = "secret";
      axios.post.mockResolvedValueOnce({ data: { token: "sr-token-1" } });

      const shiprocket = loadShiprocket();
      const token = await shiprocket.getShiprocketToken();

      expect(token).toBe("sr-token-1");
      expect(axios.post).toHaveBeenCalledWith(
        `${SHIPROCKET_BASE}/auth/login`,
        { email: "shop@example.com", password: "secret" }
      );
    });

    it("returns null when login fails", async () => {
      process.env.SHIPROCKET_EMAIL = "shop@example.com";
      process.env.SHIPROCKET_PASSWORD = "bad";
      axios.post.mockRejectedValueOnce({
        response: { data: { message: "Invalid credentials" } },
        message: "Request failed",
      });

      const shiprocket = loadShiprocket();
      await expect(shiprocket.getShiprocketToken()).resolves.toBeNull();
    });
  });

  describe("getShippingRate", () => {
    it("fails when auth is unavailable", async () => {
      const shiprocket = loadShiprocket();
      const result = await shiprocket.getShippingRate("110006", "400001", 0.5);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Missing SHIPROCKET|authentication failed/i);
    });

    it("calls serviceability with pickup, delivery, weight, COD", async () => {
      process.env.SHIPROCKET_EMAIL = "shop@example.com";
      process.env.SHIPROCKET_PASSWORD = "secret";
      axios.post.mockResolvedValueOnce({ data: { token: "sr-token" } });
      axios.get.mockResolvedValueOnce({
        data: { data: { available_courier_companies: [{ courier_name: "X" }] } },
      });

      const shiprocket = loadShiprocket();
      const result = await shiprocket.getShippingRate("110006", "400001", 0.5, 500);

      expect(result.success).toBe(true);
      expect(axios.get).toHaveBeenCalledWith(
        `${SHIPROCKET_BASE}/courier/serviceability/?pickup_postcode=110006&delivery_postcode=400001&weight=0.5&cod=1`,
        { headers: { Authorization: "Bearer sr-token" } }
      );
    });
  });

  describe("createShiprocketOrder", () => {
    it("rejects empty items", async () => {
      process.env.SHIPROCKET_EMAIL = "shop@example.com";
      process.env.SHIPROCKET_PASSWORD = "secret";
      const shiprocket = loadShiprocket();
      const result = await shiprocket.createShiprocketOrder({ orderId: "ORD1" });
      expect(result).toEqual({
        success: false,
        error: "Order items are required",
      });
    });

    it("posts adhoc order with Primary pickup and COD", async () => {
      process.env.SHIPROCKET_EMAIL = "shop@example.com";
      process.env.SHIPROCKET_PASSWORD = "secret";
      axios.post.mockResolvedValueOnce({ data: { token: "sr-token" } });
      axios.mockResolvedValueOnce({
        data: { order_id: 98765, shipment_id: 111 },
      });

      const shiprocket = loadShiprocket();
      const result = await shiprocket.createShiprocketOrder({
        orderId: "ORD123",
        billingCustomerName: "Ravi Kumar",
        billingAddress: "Lane 1",
        billingCity: "Mumbai",
        billingPincode: "400001",
        billingState: "Maharashtra",
        billingEmail: "ravi@example.com",
        billingPhone: "9999999999",
        paymentMethod: "COD",
        subtotal: 450,
        weight: 0.5,
        shippingCharges: 80,
        items: [
          {
            name: "Kaju Katli",
            sku: "KK-1",
            quantity: 2,
            price: 225,
            discount: 0,
            tax: 0,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.shiprocketOrderId).toBe(98765);

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "post",
          url: `${SHIPROCKET_BASE}/orders/create/adhoc`,
          headers: expect.objectContaining({
            Authorization: "Bearer sr-token",
          }),
          data: expect.objectContaining({
            order_id: "ORD123",
            pickup_location: "Primary",
            billing_customer_name: "Ravi",
            billing_last_name: "Kumar",
            billing_pincode: "400001",
            payment_method: "COD",
            sub_total: 450,
            weight: 0.5,
            shipping_charges: 80,
            order_items: [
              expect.objectContaining({
                name: "Kaju Katli",
                sku: "KK-1",
                units: 2,
                selling_price: 225,
              }),
            ],
          }),
        })
      );
    });

    it("omits channel_id when SHIPROCKET_CHANNEL_ID is empty", async () => {
      process.env.SHIPROCKET_EMAIL = "shop@example.com";
      process.env.SHIPROCKET_PASSWORD = "secret";
      process.env.SHIPROCKET_CHANNEL_ID = "";
      axios.post.mockResolvedValueOnce({ data: { token: "sr-token" } });
      axios.mockResolvedValueOnce({ data: { order_id: 1 } });

      const shiprocket = loadShiprocket();
      await shiprocket.createShiprocketOrder({
        orderId: "ORD2",
        items: [{ name: "Namkeen", quantity: 1, price: 100 }],
      });

      const call = axios.mock.calls[0][0];
      expect(call.data.channel_id).toBeUndefined();
    });

  });
});
