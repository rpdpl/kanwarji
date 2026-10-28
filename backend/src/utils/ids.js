function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateOrderId() {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `ORD${timestamp}${random}`;
}

/** +100 g packing buffer per 1 kg of product (e.g. 2 kg → 2.2 kg, 10 kg → 11 kg). */
function calculateBilledWeight(w) {
  const weight = parseFloat(w);
  if (isNaN(weight) || weight <= 0) return 0;
  return Math.round(weight * 1.1 * 1000) / 1000;
}

module.exports = {
  generateOTP,
  generateOrderId,
  calculateBilledWeight,
};
