const pino = require("pino");

const isProd = process.env.NODE_ENV === "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  base: { service: "e-com-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

/**
 * Structured third-party API log (Shiprocket / Instamojo / etc).
 * @param {string} service
 * @param {string} action
 * @param {object} [meta]
 */
function logThirdParty(service, action, meta = {}) {
  const { success, error, statusCode, orderId, data, ...rest } = meta;
  const payload = {
    thirdParty: service,
    action,
    success: success !== false,
    orderId: orderId || undefined,
    statusCode: statusCode || undefined,
    error: error
      ? typeof error === "string"
        ? error
        : error?.message || JSON.stringify(error)
      : undefined,
    responseSnippet: data
      ? typeof data === "string"
        ? data.slice(0, 500)
        : JSON.stringify(data).slice(0, 500)
      : undefined,
    ...rest,
  };

  if (success === false) {
    logger.error(payload, `[${service}] ${action} failed`);
  } else {
    logger.info(payload, `[${service}] ${action}`);
  }
}

module.exports = { logger, logThirdParty };
