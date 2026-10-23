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

function calculateBilledWeight(w) {
  const weight = parseFloat(w);
  if (isNaN(weight) || weight <= 0) return 0.5;

  if (weight === 0.5) return 0.5;
  if (weight >= 1.0 && Number.isInteger(weight)) return weight;

  if (weight <= 0.25) return 0.5;
  if (weight <= 0.75) return 1.0;
  return Math.ceil(weight - 0.75) + 1;
}

module.exports = {
  generateOTP,
  generateOrderId,
  calculateBilledWeight,
};
