jest.mock("../../services/shiprocket", () => ({
  createShiprocketOrder: jest.fn(),
  assignAwb: jest.fn(),
}));

const shiprocket = require("../../services/shiprocket");
const {
  createShipmentForOrder,
} = require("../../src/utils/createShipmentForOrder");

function makeOrder(overrides = {}) {
  const order = {
    orderId: "ORD-TEST-1",
    paymentMethod: "cod",
    subtotal: 100,
    weight: 0.5,
    shiprocketFee: 40,
    convenienceFee: 0,
    address: {
      name: "Test User",
      phone: "9999999999",
      address: "Somewhere in Delhi",
      city: "Delhi",
      state: "Delhi",
      pincode: "110006",
    },
    items: [{ name: "Item", itemId: "sku1", quantity: 1, price: 100 }],
    requestedShippingMode: "quick",
    shippingMode: "quick",
    deliveryLat: 28.65,
    deliveryLong: 77.23,
    courierCompanyId: "12",
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return order;
}

describe("createShipmentForOrder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates quick shipment and assigns AWB without passing Instant Pickup courier id", async () => {
    shiprocket.createShiprocketOrder.mockResolvedValueOnce({
      success: true,
      shiprocketOrderId: 100,
      shipmentId: 200,
    });
    shiprocket.assignAwb.mockResolvedValueOnce({
      success: true,
      awbNumber: "AWB-Q",
    });

    const order = makeOrder();
    const result = await createShipmentForOrder(order, {
      email: "a@b.com",
    });

    expect(result.success).toBe(true);
    expect(result.shippingMode).toBe("quick");
    expect(result.shippingFallbackUsed).toBe(false);
    expect(order.awbNumber).toBe("AWB-Q");
    expect(order.shippingMode).toBe("quick");
    expect(shiprocket.createShiprocketOrder).toHaveBeenCalledWith(
      expect.objectContaining({ shippingMode: "quick" })
    );
    // Quick must auto-assign — never pass checkout Instant Pickup courier id
    expect(shiprocket.assignAwb).toHaveBeenCalledWith(200, undefined);
  });

  it("falls back to standard when quick create fails", async () => {
    shiprocket.createShiprocketOrder
      .mockResolvedValueOnce({ success: false, error: "no hyperlocal" })
      .mockResolvedValueOnce({
        success: true,
        shiprocketOrderId: 300,
        shipmentId: 400,
      });
    shiprocket.assignAwb.mockResolvedValueOnce({
      success: true,
      awbNumber: "AWB-S",
    });

    const order = makeOrder();
    const result = await createShipmentForOrder(order, {
      email: "a@b.com",
    });

    expect(result.success).toBe(true);
    expect(result.shippingFallbackUsed).toBe(true);
    expect(order.shippingMode).toBe("standard");
    expect(order.shippingFallbackUsed).toBe(true);
    expect(shiprocket.createShiprocketOrder).toHaveBeenCalledTimes(2);
  });

  it("does not fall back to standard when quick create OK but AWB fails", async () => {
    shiprocket.createShiprocketOrder.mockResolvedValueOnce({
      success: true,
      shiprocketOrderId: 111,
      shipmentId: 222,
    });
    shiprocket.assignAwb.mockResolvedValueOnce({
      success: false,
      error: "Wallet balance is low. Please recharge.",
      data: { status: 350, message: "Wallet balance is low" },
    });

    const order = makeOrder();
    const result = await createShipmentForOrder(order, {
      email: "a@b.com",
    });

    expect(result.success).toBe(false);
    expect(result.partial).toBe(true);
    expect(order.shiprocketOrderId).toBe("111");
    expect(order.shipmentStatus).toBe("failed");
    expect(order.shiprocketError).toMatch(/Wallet|AWB/i);
    expect(shiprocket.createShiprocketOrder).toHaveBeenCalledTimes(1);
    expect(Array.isArray(order.thirdPartyLogs)).toBe(true);
    expect(order.thirdPartyLogs.some((l) => l.action === "assign_awb_quick" && !l.success)).toBe(
      true
    );
  });
});
