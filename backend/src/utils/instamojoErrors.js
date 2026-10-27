/**
 * Flatten Instamojo / axios error bodies into a user-facing message.
 * Instamojo often returns: { email: ["Enter a valid ..."], phone: ["..."], amount: ["..."] }
 * or { message: "..." } / { success: false, message: "..." }.
 */
function formatInstamojoError(data, fallback = "Failed to create payment request") {
  if (!data) return fallback;
  if (typeof data === "string") {
    const t = data.trim();
    return t || fallback;
  }
  if (typeof data !== "object") return fallback;

  if (typeof data.message === "string" && data.message.trim()) {
    return data.message.trim();
  }

  const fieldLabels = {
    email: "Email",
    phone: "Phone",
    amount: "Amount",
    buyer_name: "Name",
    purpose: "Purpose",
    redirect_url: "Redirect URL",
    webhook: "Webhook URL",
  };

  const parts = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "success" || key === "message") continue;
    const label = fieldLabels[key] || key;
    if (Array.isArray(value)) {
      const msgs = value.map((v) => String(v).trim()).filter(Boolean);
      if (msgs.length) parts.push(`${label}: ${msgs.join("; ")}`);
    } else if (value != null && String(value).trim()) {
      parts.push(`${label}: ${String(value).trim()}`);
    }
  }

  if (parts.length) return parts.join(". ");
  return fallback;
}

function isInstamojoClientError(err) {
  const status = err?.response?.status;
  return status >= 400 && status < 500;
}

/**
 * Basic buyer/amount checks before calling Instamojo.
 * @returns {string|null} error message or null if ok
 */
function validateInstamojoBuyer({ email, phone, amount }) {
  const em = String(email || "").trim();
  if (!em) return "A valid email is required for online payment";
  // Practical email check (Instamojo rejects many bad formats)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    return "Invalid email address. Please update your account email and try again.";
  }

  const ph = String(phone || "").replace(/\D/g, "");
  if (!ph) {
    return "A valid phone number is required for online payment";
  }
  // Allow 10-digit Indian or with country code 91XXXXXXXXXX
  if (!(ph.length === 10 || (ph.length === 12 && ph.startsWith("91")))) {
    return "Invalid phone number. Use a 10-digit mobile number.";
  }

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 1) {
    return "Payment amount must be at least ₹1";
  }
  if (amt > 200000) {
    return "Payment amount exceeds Instamojo maximum (₹2,00,000)";
  }

  return null;
}

module.exports = {
  formatInstamojoError,
  isInstamojoClientError,
  validateInstamojoBuyer,
};
