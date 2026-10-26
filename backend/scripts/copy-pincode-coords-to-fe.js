const fs = require("fs");
const path = require("path");

const srcPath = path.join(__dirname, "../src/utils/pincodeCoords.js");
const destPath = path.join(
  __dirname,
  "../../frontend/src/utils/pincodeCoords.js"
);
const src = fs.readFileSync(srcPath, "utf8");
const match = src.match(/const PINCODE_COORDS = \{[\s\S]*?\n\};/);
if (!match) throw new Error("PINCODE_COORDS block not found");

const out = `/** Delhi 110xxx pin centroids — keep in sync with backend/src/utils/pincodeCoords.js */
${match[0]}

function normalizePincode(pincode) {
  return String(pincode || "").replace(/\\D/g, "").slice(0, 6);
}

export function getPincodeCoords(pincode) {
  const pin = normalizePincode(pincode);
  const entry = PINCODE_COORDS[pin];
  if (!entry) return null;
  const lat = Number(entry.lat);
  const long = Number(entry.long);
  if (!Number.isFinite(lat) || !Number.isFinite(long)) return null;
  return { lat, long };
}

/** Quick is available only when we have a pin centroid (Delhi 110xxx for now). */
export function isPinQuickAvailable(pincode) {
  return !!getPincodeCoords(pincode);
}

export { PINCODE_COORDS };
`;

fs.writeFileSync(destPath, out);
console.log("Wrote", destPath);
