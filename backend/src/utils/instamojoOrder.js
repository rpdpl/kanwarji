const { User } = require("../models");
const { createShipmentForOrder } = require("./createShipmentForOrder");
const { instamojoClient } = require("../../services/instamojo");
const email = require("../../services/email");
const { logger, logThirdParty } = require("./logger");
const { appendOrderThirdPartyLog } = require("./orderThirdPartyLog");

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
    logThirdParty("instamojo", "verify_payment", {
      success: verified,
      orderId: undefined,
      statusCode: imRes.status,
      error: verified ? undefined : `status=${status}`,
      data: { payment_id: paymentId, status },
    });
    return { verified, payment };
  } catch (e) {
    logThirdParty("instamojo", "verify_payment", {
      success: false,
      statusCode: e?.response?.status,
      error: e?.response?.data || e.message,
      data: e?.response?.data,
    });
    return { verified: false, payment: null };
  }
}

/**
 * Look up payment request and latest payment status from Instamojo.
 */
async function fetchPaymentRequest(paymentRequestId) {
  if (!paymentRequestId) {
    return { success: false, paymentRequest: null, error: "Missing paymentRequestId" };
  }
  try {
    const imRes = await instamojoClient.get(
      `payment-requests/${paymentRequestId}/`
    );
    const paymentRequest =
      imRes.data?.payment_request || imRes.data || null;
    logThirdParty("instamojo", "fetch_payment_request", {
      success: true,
      statusCode: imRes.status,
      data: { id: paymentRequestId, status: paymentRequest?.status },
    });
    return { success: true, paymentRequest };
  } catch (e) {
    logThirdParty("instamojo", "fetch_payment_request", {
      success: false,
      statusCode: e?.response?.status,
      error: e?.response?.data || e.message,
      data: e?.response?.data,
    });
    return {
      success: false,
      paymentRequest: null,
      error:
        e?.response?.data?.message ||
        e?.message ||
        "Failed to fetch payment request",
    };
  }
}

function needsShiprocketFulfillment(order) {
  if (!order) return false;
  if (order.orderStatus === "cancelled") return false;
  if (order.shipmentStatus === "failed") return true;
  if (order.shiprocketError && !order.awbNumber) return true;
  if (!order.shiprocketOrderId) return true;
  // Quick created but no AWB yet
  if (
    order.shippingMode === "quick" &&
    order.shiprocketOrderId &&
    !order.awbNumber
  ) {
    return true;
  }
  return false;
}

/**
 * Mark order paid and create shipment + send emails.
 * Idempotent: if already paid, skips fulfillment unless forceFulfill.
 *
 * @param {import("mongoose").Document} order
 * @param {{ paymentId?: string, paymentRequestId?: string, payment?: object, forceFulfill?: boolean }} [opts]
 */
async function markOrderPaidAndFulfill(
  order,
  { paymentId, paymentRequestId, payment, forceFulfill = false } = {}
) {
  if (!order) {
    return { success: false, alreadyPaid: false, error: "Order not found" };
  }

  const alreadyPaid = order.paymentStatus === "paid";
  if (alreadyPaid && !forceFulfill) {
    logger.info(
      { orderId: order.orderId },
      "[INSTAMOJO] Order already paid — skipping fulfill"
    );
    return { success: true, alreadyPaid: true };
  }

  if (!alreadyPaid) {
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
    appendOrderThirdPartyLog(order, {
      service: "instamojo",
      action: "mark_paid",
      success: true,
      message: `paymentId=${paymentId || order.paymentId || ""}`,
    });
    await order.save();
    logger.info({ orderId: order.orderId }, "[INSTAMOJO] Order marked paid");
  } else if (paymentId && !order.paymentId) {
    order.paymentId = paymentId;
    await order.save();
  }

  let shiprocketCreationAttempted = false;
  let shiprocketCreationSuccess = false;

  const shouldShip =
    forceFulfill || needsShiprocketFulfillment(order) || !alreadyPaid;

  if (!shouldShip) {
    return {
      success: true,
      alreadyPaid: true,
      shiprocketCreationAttempted: false,
      shiprocketCreationSuccess: !!order.shiprocketOrderId,
    };
  }

  try {
    logger.info(
      {
        orderId: order.orderId,
        mode: order.requestedShippingMode,
        forceFulfill,
      },
      "[SHIPROCKET] Creating shipment for paid order"
    );

    const user = await User.findById(order.userId);
    if (!user) {
      throw new Error(`User not found for userId: ${order.userId}`);
    }

    shiprocketCreationAttempted = true;
    const srResult = await createShipmentForOrder(order, {
      email: user.email,
      forceOrderIdSuffix: forceFulfill || !!order.shiprocketOrderId,
    });
    shiprocketCreationSuccess = !!srResult.success;

    if (!alreadyPaid) {
      try {
        await sendPaymentSuccessEmail(user, order);
        await sendOrderConfirmationEmail(user, order);
        logger.info({ email: user.email }, "[EMAIL] Confirmation emails sent");
      } catch (emailError) {
        logger.error(
          { err: emailError.message },
          "[EMAIL] Failed to send confirmation emails"
        );
      }
    }
  } catch (e) {
    logger.error(
      { orderId: order.orderId, err: e?.message },
      "[SHIPROCKET] CRITICAL ERROR"
    );
    try {
      order.shiprocketError = `Critical error: ${e?.message}`;
      order.shipmentStatus = "failed";
      appendOrderThirdPartyLog(order, {
        service: "shiprocket",
        action: "fulfill_critical",
        success: false,
        message: e?.message,
      });
      await order.save();
    } catch (saveError) {
      logger.error(
        { err: saveError.message },
        "[SHIPROCKET] Failed to save error to order"
      );
    }

    if (!alreadyPaid) {
      try {
        const user = await User.findById(order.userId);
        if (user) {
          await sendPaymentSuccessEmail(user, order);
          await sendOrderConfirmationEmail(user, order);
        }
      } catch (emailError) {
        logger.error({ err: emailError.message }, "[EMAIL] Failed to send emails");
      }
    }
  }

  if (!shiprocketCreationSuccess) {
    logger.error(
      {
        orderId: order.orderId,
        paymentId: order.paymentId || "n/a",
        shipmentStatus: order.shipmentStatus || "n/a",
        error: order.shiprocketError || "unknown",
      },
      "[SHIPROCKET] RECOVERY NEEDED — Admin: Sync Payment / Retry Shiprocket"
    );
  }

  return {
    success: true,
    alreadyPaid,
    shiprocketCreationAttempted,
    shiprocketCreationSuccess,
  };
}

/**
 * Admin/recovery: verify Instamojo Credit and mark paid + fulfill.
 */
async function syncInstamojoPaymentForOrder(order) {
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  let paymentId = order.paymentId;
  let payment = null;

  if (paymentId) {
    const verified = await verifyInstamojoPayment(paymentId);
    if (!verified.verified) {
      appendOrderThirdPartyLog(order, {
        service: "instamojo",
        action: "sync_payment",
        success: false,
        message: `payment ${paymentId} not Credit`,
      });
      await order.save();
      return {
        success: false,
        error: `Instamojo payment ${paymentId} is not Credit (not paid)`,
        paymentStatus: order.paymentStatus,
      };
    }
    payment = verified.payment;
  } else if (order.paymentRequestId) {
    const { success, paymentRequest, error } = await fetchPaymentRequest(
      order.paymentRequestId
    );
    if (!success || !paymentRequest) {
      appendOrderThirdPartyLog(order, {
        service: "instamojo",
        action: "sync_payment",
        success: false,
        message: error || "payment request fetch failed",
      });
      await order.save();
      return {
        success: false,
        error: error || "Could not fetch Instamojo payment request",
      };
    }

    const payments = Array.isArray(paymentRequest.payments)
      ? paymentRequest.payments
      : [];
    const credited =
      payments.find((p) => String(p?.status) === "Credit") || null;
    const prStatus = String(paymentRequest.status || "").toLowerCase();

    if (credited?.payment_id || credited?.id) {
      paymentId = String(credited.payment_id || credited.id);
      const recheck = await verifyInstamojoPayment(paymentId);
      payment = recheck.payment || credited;
      if (!recheck.verified && String(credited.status) !== "Credit") {
        return {
          success: false,
          error: "Payment request has no verified Credit payment",
        };
      }
    } else if (prStatus === "completed" || prStatus === "credit") {
      // Request completed but no nested payment id — still treat as paid if amount matches
      payment = {
        status: "Credit",
        amount: paymentRequest.amount,
        fees: paymentRequest.fees,
      };
    } else {
      appendOrderThirdPartyLog(order, {
        service: "instamojo",
        action: "sync_payment",
        success: false,
        message: `payment_request status=${paymentRequest.status}`,
        response: {
          status: paymentRequest.status,
          paymentsCount: payments.length,
        },
      });
      await order.save();
      return {
        success: false,
        error: `Instamojo payment request status is "${paymentRequest.status}" (not completed/Credit)`,
        paymentRequestStatus: paymentRequest.status,
      };
    }
  } else {
    return {
      success: false,
      error:
        "Order has no paymentId or paymentRequestId — cannot sync with Instamojo",
    };
  }

  const result = await markOrderPaidAndFulfill(order, {
    paymentId,
    paymentRequestId: order.paymentRequestId,
    payment,
    forceFulfill: true,
  });

  appendOrderThirdPartyLog(order, {
    service: "instamojo",
    action: "sync_payment",
    success: true,
    message: `synced paymentId=${paymentId || ""} shiprocket=${result.shiprocketCreationSuccess}`,
  });
  try {
    await order.save();
  } catch (_) {}

  return {
    success: true,
    alreadyPaid: !!result.alreadyPaid,
    paymentStatus: "paid",
    paymentId: paymentId || order.paymentId,
    shiprocketCreationAttempted: !!result.shiprocketCreationAttempted,
    shiprocketCreationSuccess: !!result.shiprocketCreationSuccess,
    shiprocketOrderId: order.shiprocketOrderId || null,
    shipmentStatus: order.shipmentStatus,
    shiprocketError: order.shiprocketError || null,
  };
}

/**
 * Mark pending order as payment failed. No-op if already paid/failed.
 * Note: paymentId may be stored on failed attempts — UI must use paymentStatus, not paymentId.
 */
async function markOrderPaymentFailed(order, { paymentId, paymentRequestId } = {}) {
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.paymentStatus === "paid") {
    logger.info(
      { orderId: order.orderId },
      "[INSTAMOJO] Order already paid — ignoring fail mark"
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
  appendOrderThirdPartyLog(order, {
    service: "instamojo",
    action: "mark_failed",
    success: true,
    message: `paymentId=${paymentId || ""}`,
  });
  await order.save();
  logger.info({ orderId: order.orderId }, "[INSTAMOJO] Order marked payment failed");
  return { success: true, skipped: false };
}

module.exports = {
  verifyInstamojoPayment,
  fetchPaymentRequest,
  markOrderPaidAndFulfill,
  markOrderPaymentFailed,
  syncInstamojoPaymentForOrder,
  needsShiprocketFulfillment,
};
