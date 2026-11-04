/**
 * Append a capped third-party log entry on an order document (in-memory; caller saves).
 * @param {import("mongoose").Document|object} order
 * @param {{ service: string, action: string, success?: boolean, message?: string, statusCode?: number, response?: any }} entry
 */
function appendOrderThirdPartyLog(order, entry) {
  if (!order || !entry?.service || !entry?.action) return;

  if (!Array.isArray(order.thirdPartyLogs)) {
    order.thirdPartyLogs = [];
  }

  order.thirdPartyLogs.push({
    service: String(entry.service),
    action: String(entry.action),
    success: entry.success !== false,
    message: entry.message ? String(entry.message).slice(0, 1000) : "",
    statusCode:
      entry.statusCode != null && Number.isFinite(Number(entry.statusCode))
        ? Number(entry.statusCode)
        : undefined,
    response: entry.response != null ? entry.response : undefined,
    at: new Date(),
  });

  // Keep last 20 entries to avoid unbounded growth
  if (order.thirdPartyLogs.length > 20) {
    order.thirdPartyLogs = order.thirdPartyLogs.slice(-20);
  }
}

module.exports = { appendOrderThirdPartyLog };
