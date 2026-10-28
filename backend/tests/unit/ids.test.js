const {
  generateOTP,
  generateOrderId,
  calculateBilledWeight,
} = require("../../src/utils/ids");

describe("utils/ids", () => {
  describe("generateOTP", () => {
    it("returns a 6-digit string", () => {
      const otp = generateOTP();
      expect(otp).toMatch(/^\d{6}$/);
      const n = Number(otp);
      expect(n).toBeGreaterThanOrEqual(100000);
      expect(n).toBeLessThanOrEqual(999999);
    });
  });

  describe("generateOrderId", () => {
    it("returns ORD + timestamp + 3-digit suffix", () => {
      const id = generateOrderId();
      expect(id).toMatch(/^ORD\d{13}\d{3}$/);
    });

    it("produces unique ids across calls", () => {
      const a = generateOrderId();
      const b = generateOrderId();
      expect(a).not.toBe(b);
    });
  });

  describe("calculateBilledWeight", () => {
    it("returns 0 for invalid or non-positive weights", () => {
      expect(calculateBilledWeight(undefined)).toBe(0);
      expect(calculateBilledWeight("x")).toBe(0);
      expect(calculateBilledWeight(0)).toBe(0);
      expect(calculateBilledWeight(-1)).toBe(0);
    });

    it("adds 100g packing buffer per kg of product", () => {
      expect(calculateBilledWeight(1)).toBe(1.1);
      expect(calculateBilledWeight(2)).toBe(2.2);
      expect(calculateBilledWeight(10)).toBe(11);
    });

    it("scales buffer proportionally for fractional kg", () => {
      expect(calculateBilledWeight(0.5)).toBe(0.55);
      expect(calculateBilledWeight(1.5)).toBe(1.65);
    });
  });
});
