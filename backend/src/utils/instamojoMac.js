const crypto = require("crypto");

/**
 * Verify Instamojo webhook MAC (HMAC-SHA1).
 * Docs: remove mac, sort remaining keys case-insensitively, join values with "|",
 * HMAC-SHA1 with private salt, compare hex digests.
 *
 * @param {Record<string, unknown>} payload - form body including mac
 * @param {string} privateSalt
 * @returns {boolean}
 */
function verifyInstamojoMac(payload, privateSalt) {
  if (!payload || typeof payload !== "object") return false;
  if (!privateSalt || typeof privateSalt !== "string") return false;

  const macProvided = String(payload.mac || "").trim().toLowerCase();
  if (!macProvided) return false;

  const data = { ...payload };
  delete data.mac;

  const keys = Object.keys(data).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const message = keys.map((k) => String(data[k] ?? "")).join("|");
  const macCalculated = crypto
    .createHmac("sha1", privateSalt)
    .update(message)
    .digest("hex")
    .toLowerCase();

  try {
    const a = Buffer.from(macProvided, "utf8");
    const b = Buffer.from(macCalculated, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

module.exports = { verifyInstamojoMac };
