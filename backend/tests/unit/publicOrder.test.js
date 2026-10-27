const { toPublicOrder } = require("../../src/utils/publicOrder");

describe("toPublicOrder", () => {
  it("keeps customer-safe fields and strips sensitive ones", () => {
    const pub = toPublicOrder({
      _id: "abc",
      orderId: "ORD-1",
      items: [
        {
          name: "Kaju",
          price: 100,
          quantity: 1,
          itemId: "secret-item",
          sellerId: "seller-1",
        },
      ],
      address: {
        name: "A",
        phone: "9999999999",
        address: "Street",
        city: "Delhi",
        state: "Delhi",
        pincode: "110006",
      },
      paymentMethod: "online",
      paymentStatus: "paid",
      orderStatus: "confirmed",
      paymentId: "MOJO-SECRET",
      paymentRequestId: "REQ-SECRET",
      shiprocketOrderId: "SR-SECRET",
      shiprocketError: "vendor boom",
      deliveryLat: 28.6,
      deliveryLong: 77.2,
      courierCompanyId: "55",
      courierName: "Delhivery",
      courierRate: 80,
      courierEtd: "in 2 days",
      adminRemarks: "internal note",
      subtotal: 100,
      shiprocketFee: 80,
      taxAmount: 0,
      totalAmount: 180,
      convenienceFee: 0,
      shippingMode: "standard",
      awbNumber: "AWB1",
      shipmentStatus: "created",
      createdAt: new Date("2026-01-01"),
    });

    expect(pub.orderId).toBe("ORD-1");
    expect(pub.courierName).toBe("Delhivery");
    expect(pub.awbNumber).toBe("AWB1");
    expect(pub.items[0].name).toBe("Kaju");
    expect(pub.items[0].itemId).toBeUndefined();
    expect(pub.items[0].sellerId).toBeUndefined();
    expect(pub.paymentId).toBeUndefined();
    expect(pub.paymentRequestId).toBeUndefined();
    expect(pub.shiprocketOrderId).toBeUndefined();
    expect(pub.shiprocketError).toBeUndefined();
    expect(pub.deliveryLat).toBeUndefined();
    expect(pub.deliveryLong).toBeUndefined();
    expect(pub.courierCompanyId).toBeUndefined();
    expect(pub.adminRemarks).toBeUndefined();
  });
});
