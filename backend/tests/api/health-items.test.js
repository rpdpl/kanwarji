const express = require("express");
const request = require("supertest");
const { createMockModels } = require("../helpers/mockModels");

jest.mock("../../services/email", () => ({
  transporter: { verify: jest.fn(), sendMail: jest.fn() },
  formatIST: jest.fn(() => "01 Jan 2026, 10:00 AM (IST)"),
  sendSignupMail: jest.fn(),
  sendPaymentSuccessEmail: jest.fn(),
  sendOrderConfirmationEmail: jest.fn(),
  sendOrderCancellationEmail: jest.fn(),
  sendMail: jest.fn(),
}));

jest.mock("../../services/instamojo", () => ({
  instamojoClient: { post: jest.fn(), get: jest.fn() },
  processInstamojoRefund: jest.fn(),
  INSTAMOJO_API_KEY: "",
  INSTAMOJO_AUTH_TOKEN: "",
}));

jest.mock("../../services/shiprocket", () => ({
  getShiprocketToken: jest.fn(),
  createShiprocketOrder: jest.fn(),
  getShippingRate: jest.fn(),
  trackShipment: jest.fn(),
  generateLabel: jest.fn(),
  cancelShiprocketOrder: jest.fn(),
  getShipmentDetails: jest.fn(),
}));

const mockModels = createMockModels({
  sellers: [{ _id: "seller1" }],
  items: [
    {
      _id: "item1",
      name: "Kaju Katli",
      productDetails: "Fresh mithai",
      price: 500,
      category: "Mithai",
      sellerName: "admin",
      isAvailable: true,
    },
  ],
});

jest.mock("../../src/models", () => mockModels);

jest.mock("../../src/middleware/upload", () => ({
  upload: {
    fields: jest.fn(() => (req, res, next) => next()),
    single: jest.fn(() => (req, res, next) => next()),
  },
  uploadDir: "/tmp",
}));

jest.mock("../../src/utils/invoice", () => ({
  generateInvoicePDF: jest.fn(),
}));

describe("API health + items", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    require("../../src/routes/misc")(app);
    require("../../src/routes/items")(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockModels.User.find.mockImplementation(() => ({
      select: jest.fn().mockResolvedValue([{ _id: "seller1" }]),
    }));
    mockModels.Item.find.mockImplementation(() => {
      const { createFindChain } = require("../helpers/mockModels");
      return createFindChain([
        {
          _id: "item1",
          name: "Kaju Katli",
          productDetails: "Fresh mithai",
          price: 500,
          category: "Mithai",
          sellerName: "admin",
          isAvailable: true,
        },
      ]);
    });
    mockModels.Item.countDocuments.mockResolvedValue(1);
  });

  describe("GET /health", () => {
    it("returns ok", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  describe("GET /api/items", () => {
    it("returns success payload with items list", async () => {
      const res = await request(app).get("/api/items");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items[0].name).toBe("Kaju Katli");
      expect(res.body.totalItems).toBe(1);
      expect(res.body.totalPages).toBe(1);
      expect(mockModels.User.find).toHaveBeenCalled();
      expect(mockModels.Item.find).toHaveBeenCalled();
    });

    it("returns empty list shape when no items", async () => {
      const { createFindChain } = require("../helpers/mockModels");
      mockModels.User.find.mockImplementation(() => ({
        select: jest.fn().mockResolvedValue([]),
      }));
      mockModels.Item.find.mockImplementation(() => createFindChain([]));
      mockModels.Item.countDocuments.mockResolvedValue(0);

      const res = await request(app).get("/api/items");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        items: [],
        totalItems: 0,
        totalPages: 0,
      });
    });
  });

  describe("GET /api/admin-items", () => {
    it("returns admin catalog shape", async () => {
      const res = await request(app).get("/api/admin-items?limit=2");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items[0].name).toBe("Kaju Katli");
      expect(res.body.message).toMatch(/Admin items/i);
    });
  });
});
