/**
 * Shared shipping labels for Admin/FE/invoice/email/Instamojo/Shiprocket notes.
 * Source of truth: Order fields saved at checkout.
 */

function getShippingModeLabel(order) {
  const mode = String(order?.shippingMode || order?.requestedShippingMode || "").toLowerCase();
  if (mode === "quick") return "Same day (Quick)";
  if (mode === "standard") return "Standard";
  return mode ? String(mode) : "Standard";
}

function formatFeeInr(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `₹${n.toFixed(2)}`;
}

/**
 * Compact one-line summary: mode · courier · fee · ETA
 */
function formatShippingSummary(order) {
  if (!order) return "";
  const parts = [];
  parts.push(getShippingModeLabel(order));

  const courier = String(order.courierName || "").trim();
  if (courier) parts.push(courier);

  const fee =
    formatFeeInr(order.courierRate) ||
    formatFeeInr(order.shiprocketFee);
  if (fee) parts.push(fee);

  const etd = String(order.courierEtd || "").trim();
  if (etd) parts.push(etd);

  return parts.join(" · ");
}

/**
 * Instamojo payment purpose: order id + shipping summary, length-capped.
 */
function formatInstamojoPurpose(order, maxLen = 200) {
  const id = String(order?.orderId || "ORDER").trim();
  const summary = formatShippingSummary(order);
  let purpose = summary ? `Order ${id} | ${summary}` : `Order ${id}`;
  if (purpose.length > maxLen) {
    purpose = purpose.slice(0, Math.max(0, maxLen - 3)).trimEnd() + "...";
  }
  return purpose;
}

module.exports = {
  getShippingModeLabel,
  formatShippingSummary,
  formatInstamojoPurpose,
};
