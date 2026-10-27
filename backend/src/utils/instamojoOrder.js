const { User } = require("../models");
const { createShipmentForOrder } = require("./createShipmentForOrder");
const { instamojoClient } = require("../../services/instamojo");
const email = require("../../services/email");

const { sendPaymentSuccessEmail, sendOrderConfirmationEmail } = email;

/**
 * Fetch payment from Instamojo and accept only Credit status.
 * @returns {{ verified: boolean, payment: object|null }}
 */
async function verifyInstamojoPayment(paymentId) {
  if (!paymentId) {
    return { verified: false, payment: null };
  }

  try {
    const imRes = await instamojoClient.get(`payments/${paymentId}/`);
    const payment = imRes.data?.payment || null;
    const status = String(payment?.status || "");
    const verified = status === "Credit";
    console.log(
      `[INSTAMOJO] Verify payment ${paymentId}: status=${status}, verified=${verified}`
    );
    return { verified, payment };
  } catch (e) {
    console.error(
      `[INSTAMOJO] API verification failed for ${paymentId}:`,
      e?.response?.data || e.message
    );
    return { verified: false, payment: null };
  }
}

/**
 * Mark order paid and create shipment + send emails.
 * Idempotent: if already paid, skips fulfillment side-effects.
 */
async function markOrderPaidAndFulfill(order, { paymentId, paymentRequestId, payment } = {}) {
  if (!order) {
    return { success: false, alreadyPaid: false, error: "Order not found" };
  }

  if (order.paymentStatus === "paid") {
    console.log(
      `[INSTAMOJO] Order ${order.orderId} already paid — skipping fulfill`
    );
    return { success: true, alreadyPaid: true };
  }

  order.paymentStatus = "paid";
  if (paymentId) order.paymentId = paymentId;
  if (paymentRequestId) order.paymentRequestId = paymentRequestId;
  order.orderStatus = "confirmed";
  order.updatedAt = new Date();
  order.paidAt = new Date();

  try {
    const feeFromApi = Number(payment?.fees || payment?.convenience_fee || 0);
    const paidAmt = Number(payment?.amount || 0);
    const baseAmt = Number(order.totalAmount || 0);
    const computedFee =
      feeFromApi > 0 ? feeFromApi : Math.max(0, paidAmt - baseAmt);
    if (Number.isFinite(computedFee) && computedFee > 0) {
      order.convenienceFee = computedFee;
    }
  } catch (_) {}

  await order.save();
  console.log(`[INSTAMOJO] Order ${order.orderId} updated — Status: paid`);

  let shiprocketCreationAttempted = false;
  let shiprocketCreationSuccess = false;

  try {
    console.log(
      `[SHIPROCKET] Creating shipment for paid order ${order.orderId} mode=${order.requestedShippingMode}`
    );

    const user = await User.findById(order.userId);
    if (!user) {
      throw new Error(`User not found for userId: ${order.userId}`);
    }

    shiprocketCreationAttempted = true;
    const srResult = await createShipmentForOrder(order, {
      email: user.email,
    });
    shiprocketCreationSuccess = !!srResult.success;

    try {
      await sendPaymentSuccessEmail(user, order);
      await sendOrderConfirmationEmail(user, order);
      console.log(`[EMAIL] Confirmation emails sent to ${user.email}`);
    } catch (emailError) {
      console.error(
        `[EMAIL] Failed to send confirmation emails:`,
        emailError.message
      );
    }
  } catch (e) {
    console.error(
      `[SHIPROCKET] CRITICAL ERROR for ${order.orderId}:`,
      e?.message
    );
    try {
      order.shiprocketError = `Critical error: ${e?.message}`;
      order.shipmentStatus = "failed";
      await order.save();
    } catch (saveError) {
      console.error(
        "[SHIPROCKET] Failed to save error to order:",
        saveError.message
      );
    }

    try {
      const user = await User.findById(order.userId);
      if (user) {
        await sendPaymentSuccessEmail(user, order);
        await sendOrderConfirmationEmail(user, order);
      }
    } catch (emailError) {
      console.error(`[EMAIL] Failed to send emails:`, emailError.message);
    }
  }

  if (!shiprocketCreationSuccess) {
    console.error(
      `[SHIPROCKET] RECOVERY NEEDED order=${order.orderId} paymentId=${order.paymentId || "n/a"} ` +
        `shipmentStatus=${order.shipmentStatus || "n/a"} error=${order.shiprocketError || "unknown"} ` +
        `(Admin: Retry Shiprocket on paid order)`
    );
  } else {
    console.log(
      `[SHIPROCKET] Final Status — Attempted: ${shiprocketCreationAttempted}, Success: ${shiprocketCreationSuccess}`
    );
  }

  return {
    success: true,
    alreadyPaid: false,
    shiprocketCreationAttempted,
    shiprocketCreationSuccess,
  };
}

/**
 * Mark pending order as payment failed. No-op if already paid/failed.
 */
async function markOrderPaymentFailed(order, { paymentId, paymentRequestId } = {}) {
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.paymentStatus === "paid") {
    console.log(
      `[INSTAMOJO] Order ${order.orderId} already paid — ignoring fail mark`
    );
    return { success: true, skipped: true };
  }

  if (order.paymentStatus === "failed") {
    return { success: true, skipped: true };
  }

  order.paymentStatus = "failed";
  if (paymentId) order.paymentId = paymentId;
  if (paymentRequestId) order.paymentRequestId = paymentRequestId;
  order.updatedAt = new Date();
  await order.save();
  console.log(`[INSTAMOJO] Order ${order.orderId} marked payment failed`);
  return { success: true, skipped: false };
}

module.exports = {
  verifyInstamojoPayment,
  markOrderPaidAndFulfill,
  markOrderPaymentFailed,
};
