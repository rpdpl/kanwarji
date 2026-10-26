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

  it("creates quick shipment and assigns AWB", async () => {
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
});
