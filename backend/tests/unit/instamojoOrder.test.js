jest.mock("../../services/instamojo", () => ({
  instamojoClient: {
    get: jest.fn(),
  },
}));
jest.mock("../../src/utils/createShipmentForOrder", () => ({
  createShipmentForOrder: jest.fn(),
}));
jest.mock("../../services/email", () => ({
  sendPaymentSuccessEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/models", () => ({
  User: { findById: jest.fn() },
}));

const { instamojoClient } = require("../../services/instamojo");
const { createShipmentForOrder } = require("../../src/utils/createShipmentForOrder");
const { User } = require("../../src/models");
const {
  syncInstamojoPaymentForOrder,
  markOrderPaymentFailed,
} = require("../../src/utils/instamojoOrder");

function makeOrder(overrides = {}) {
  return {
    orderId: "ORD-SYNC-1",
    userId: "user1",
    paymentMethod: "online",
    paymentStatus: "pending",
    paymentId: "pay_abc",
    paymentRequestId: "req_abc",
    orderStatus: "pending",
    shipmentStatus: "pending",
    shiprocketOrderId: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("instamojoOrder sync + failed paymentId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("syncInstamojoPaymentForOrder marks paid and fulfills when Credit", async () => {
    instamojoClient.get.mockResolvedValueOnce({
      status: 200,
      data: { payment: { status: "Credit", amount: 500, fees: 10 } },
    });
    User.findById.mockResolvedValue({ email: "a@b.com" });
    createShipmentForOrder.mockResolvedValue({
      success: true,
      shiprocketOrderId: "SR1",
    });

    const order = makeOrder();
    const result = await syncInstamojoPaymentForOrder(order);

    expect(result.success).toBe(true);
    expect(order.paymentStatus).toBe("paid");
    expect(createShipmentForOrder).toHaveBeenCalled();
  });

  it("sync fails when payment is not Credit", async () => {
    instamojoClient.get.mockResolvedValueOnce({
      status: 200,
      data: { payment: { status: "Failed", amount: 500 } },
    });

    const order = makeOrder();
    const result = await syncInstamojoPaymentForOrder(order);

    expect(result.success).toBe(false);
    expect(order.paymentStatus).toBe("pending");
    expect(createShipmentForOrder).not.toHaveBeenCalled();
  });

  it("markOrderPaymentFailed stores paymentId without marking paid", async () => {
    const order = makeOrder({ paymentId: undefined });
    const result = await markOrderPaymentFailed(order, {
      paymentId: "pay_fail",
    });
    expect(result.success).toBe(true);
    expect(order.paymentStatus).toBe("failed");
    expect(order.paymentId).toBe("pay_fail");
  });
});
