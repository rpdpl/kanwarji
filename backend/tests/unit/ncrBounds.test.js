const {
  resolvePreferredShippingMode,
} = require("../../src/utils/ncrBounds");
const { isQuickEligiblePincode } = require("../../src/utils/quickEligiblePincodes");
const { getPincodeCoords } = require("../../src/utils/pincodeCoords");

describe("pin coords + quick shipping mode", () => {
  it("treats 110006 as Quick-eligible and 400001 as not", () => {
    expect(isQuickEligiblePincode("110006")).toBe(true);
    expect(isQuickEligiblePincode("400001")).toBe(false);
  });

  it("returns centroid coords for Delhi pins", () => {
    const c = getPincodeCoords("110006");
    expect(c).toEqual({ lat: 28.653, long: 77.231 });
  });

  it("returns null for pins without coords", () => {
    expect(getPincodeCoords("201301")).toBeNull();
    expect(getPincodeCoords("400001")).toBeNull();
  });

  it("keeps Quick and attaches pin coords when pin has a centroid", () => {
    const r = resolvePreferredShippingMode({
      preferredShippingMode: "quick",
      pincode: "110006",
    });
    expect(r.preferredShippingMode).toBe("quick");
    expect(r.coerced).toBe(false);
    expect(r.latitude).toBe(28.653);
    expect(r.longitude).toBe(77.231);
  });

  it("ignores client-supplied map coords and uses pin centroid", () => {
    const r = resolvePreferredShippingMode({
      preferredShippingMode: "quick",
      pincode: "110001",
      latitude: 19.07,
      longitude: 72.87,
    });
    expect(r.preferredShippingMode).toBe("quick");
    expect(r.latitude).toBe(28.6419);
    expect(r.longitude).toBe(77.2176);
  });

  it("coerces to Standard when pin is outside Quick list", () => {
    const r = resolvePreferredShippingMode({
      preferredShippingMode: "quick",
      pincode: "400001",
    });
    expect(r.preferredShippingMode).toBe("standard");
    expect(r.coerced).toBe(true);
    expect(r.message).toMatch(/Standard/i);
  });

  it("coerces to Standard when pin is eligible but has no coords (e.g. Noida)", () => {
    const r = resolvePreferredShippingMode({
      preferredShippingMode: "quick",
      pincode: "201301",
    });
    expect(isQuickEligiblePincode("201301")).toBe(true);
    expect(r.preferredShippingMode).toBe("standard");
    expect(r.coerced).toBe(true);
  });
});
