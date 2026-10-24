const {
  shouldUseInstamojoForPincode,
  getShippingEstimate,
  DELHI_REGION_PINCODES,
} = require("../../src/utils/pincode");

describe("utils/pincode", () => {
  describe("shouldUseInstamojoForPincode", () => {
    it("treats Delhi shop pincode as local (skip Shiprocket fee path)", () => {
      expect(shouldUseInstamojoForPincode("110006")).toBe(true);
      expect(DELHI_REGION_PINCODES.has("110006")).toBe(true);
    });

    it("treats common NCR pins as local", () => {
      expect(shouldUseInstamojoForPincode("201301")).toBe(true);
      expect(shouldUseInstamojoForPincode("122001")).toBe(true);
    });

    it("treats outstation pins as non-local (Shiprocket path)", () => {
      expect(shouldUseInstamojoForPincode("400001")).toBe(false);
      expect(shouldUseInstamojoForPincode("560001")).toBe(false);
    });

    it("trims string input and handles empty", () => {
      expect(shouldUseInstamojoForPincode(" 110006 ")).toBe(true);
      expect(shouldUseInstamojoForPincode("")).toBe(false);
      expect(shouldUseInstamojoForPincode(null)).toBe(false);
    });
  });

  describe("getShippingEstimate", () => {
    it("returns the flat estimate used for local fallbacks", async () => {
      await expect(getShippingEstimate("110006", 1, true)).resolves.toBe(50);
    });
  });
});
