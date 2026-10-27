const {
  getShippingModeLabel,
  formatShippingSummary,
  formatInstamojoPurpose,
} = require("../../src/utils/orderShippingSummary");

describe("orderShippingSummary", () => {
  it("labels quick vs standard", () => {
    expect(getShippingModeLabel({ shippingMode: "quick" })).toBe(
      "Same day (Quick)"
    );
    expect(getShippingModeLabel({ shippingMode: "standard" })).toBe("Standard");
  });

  it("formats summary with courier fee and etd", () => {
    const s = formatShippingSummary({
      shippingMode: "standard",
      courierName: "Delhivery Surface",
      courierRate: 120,
      courierEtd: "in 2 days",
    });
    expect(s).toContain("Standard");
    expect(s).toContain("Delhivery Surface");
    expect(s).toContain("₹120.00");
    expect(s).toContain("in 2 days");
  });

  it("builds Instamojo purpose with order id", () => {
    const p = formatInstamojoPurpose({
      orderId: "ORD-1",
      shippingMode: "quick",
      courierName: "Same day delivery",
      shiprocketFee: 80,
      courierEtd: "within 24 hours",
    });
    expect(p.startsWith("Order ORD-1")).toBe(true);
    expect(p.length).toBeLessThanOrEqual(200);
  });
});
