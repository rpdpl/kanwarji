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
    it("defaults invalid or non-positive weights to 0.5", () => {
      expect(calculateBilledWeight(undefined)).toBe(0.5);
      expect(calculateBilledWeight("x")).toBe(0.5);
      expect(calculateBilledWeight(0)).toBe(0.5);
      expect(calculateBilledWeight(-1)).toBe(0.5);
    });

    it("keeps exact 0.5 and whole kilograms", () => {
      expect(calculateBilledWeight(0.5)).toBe(0.5);
      expect(calculateBilledWeight(1)).toBe(1);
      expect(calculateBilledWeight(2)).toBe(2);
    });

    it("rounds light parcels into 0.5 / 1.0 buckets", () => {
      expect(calculateBilledWeight(0.2)).toBe(0.5);
      expect(calculateBilledWeight(0.25)).toBe(0.5);
      expect(calculateBilledWeight(0.5)).toBe(0.5);
      expect(calculateBilledWeight(0.6)).toBe(1.0);
      expect(calculateBilledWeight(0.75)).toBe(1.0);
    });

    it("ceil-bills heavier fractional weights", () => {
      expect(calculateBilledWeight(0.8)).toBe(2);
      expect(calculateBilledWeight(1.5)).toBe(2);
    });
  });
});
