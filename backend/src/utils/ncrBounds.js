const {
  isQuickEligiblePincode,
  normalizePincode,
} = require("./quickEligiblePincodes");
const { getPincodeCoords } = require("./pincodeCoords");

/**
 * Soft-coerce preferred shipping mode for address save.
 * Quick requires eligible pin + a known pin centroid in PINCODE_COORDS.
 * Lat/long are always taken from the constant (not client map pins).
 */
function resolvePreferredShippingMode({ preferredShippingMode, pincode }) {
  const pin = normalizePincode(pincode);
  const wantsQuick =
    String(preferredShippingMode || "").toLowerCase() === "quick";
  const coords = getPincodeCoords(pin);

  if (wantsQuick && isQuickEligiblePincode(pin) && coords) {
    return {
      preferredShippingMode: "quick",
      latitude: coords.lat,
      longitude: coords.long,
      coerced: false,
      message: null,
    };
  }

  const coerced = wantsQuick;
  return {
    preferredShippingMode: "standard",
    latitude: undefined,
    longitude: undefined,
    coerced,
    message: coerced
      ? "Same day delivery isn't available for this address. Saved as Standard shipping."
      : null,
  };
}

module.exports = {
  isQuickEligiblePincode,
  resolvePreferredShippingMode,
  getPincodeCoords,
};
