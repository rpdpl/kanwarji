const {
  User,
  Order,
} = require("../models");
const { authenticateToken } = require("../middleware/auth");
const { generateOrderId, calculateBilledWeight } = require("../utils/ids");
const {
  instamojoClient,
  INSTAMOJO_PRIVATE_SALT,
} = require("../../services/instamojo");
const { verifyInstamojoMac } = require("../utils/instamojoMac");
const {
  verifyInstamojoPayment,
  markOrderPaidAndFulfill,
  markOrderPaymentFailed,
} = require("../utils/instamojoOrder");
const {
  formatInstamojoError,
  isInstamojoClientError,
  validateInstamojoBuyer,
} = require("../utils/instamojoErrors");
const { formatInstamojoPurpose } = require("../utils/orderShippingSummary");
const env = require("../config/env");

const SERVER_BASE_URL = env.SERVER_BASE_URL;
const CLIENT_BASE_URL = env.CLIENT_BASE_URL;
const BYPASS_PAYMENT_FOR_TESTING = env.BYPASS_PAYMENT_FOR_TESTING;

async function findOrderByIdOrOrderId(orderId) {
  if (!orderId) return null;
  let order = null;
  try {
    order = await Order.findById(orderId);
  } catch (_) {}
  if (!order) {
    order = await Order.findOne({ orderId });
  }
  return order;
}

module.exports = function registerPaymentsRoutes(app) {
  app.post("/api/create-instamojo-payment", authenticateToken, async (req, res) => {
    let savedOrderId = null;
    try {
      const { orderData } = req.body;
      if (!orderData) {
        return res.status(400).json({ success: false, message: "orderData required" });
      }

      const userId = req.user.id;
      console.log(
        `[INSTAMOJO PAYMENT] Creating payment for user ${userId}, amount: ${orderData.totalAmount}`
      );

      const finalShiprocketFee = Number(orderData.shiprocketFee) || 0;
      const finalTotalAmount =
        Math.round((Number(orderData.totalAmount) || 0) * 100) / 100;
      const modeRaw =
        orderData.requestedShippingMode || orderData.shippingMode || "standard";
      const mode = modeRaw === "quick" ? "quick" : "standard";
      const latNum =
        orderData.deliveryLat != null ? Number(orderData.deliveryLat) : undefined;
      const longNum =
        orderData.deliveryLong != null ? Number(orderData.deliveryLong) : undefined;

      console.log(
        `[INSTAMOJO PAYMENT] Pincode ${orderData.address?.pincode} shippingMode=${mode} fee=${finalShiprocketFee}`
      );

      const user = await User.findById(userId);
      const buyerEmail = String(user?.email || "").trim();
      const buyerPhone = String(
        orderData.address?.phone || user?.phone || ""
      ).trim();

      const buyerError = validateInstamojoBuyer({
        email: buyerEmail,
        phone: buyerPhone,
        amount: finalTotalAmount,
      });
      if (buyerError) {
        console.warn(`[INSTAMOJO PAYMENT] Buyer validation failed: ${buyerError}`);
        return res.status(400).json({ success: false, message: buyerError });
      }

      const itemsIn = orderData.items || [];
      const mappedItems = itemsIn.map((it) => ({
        itemId: it.itemId || it.productId || null,
        name: String(it.name || ""),
        price: Number(it.price || 0),
        quantity: Number(it.quantity || 0),
        unit: String(it.unit || ""),
        variantLabel: String(it.variantLabel || ""),
        sellerId: it.sellerId || null,
        sellerName: it.sellerName || "",
        tax: Number(it.tax || 0),
        discount: Number(it.discount || 0),
      }));
      const convenienceFee = Number(orderData.convenienceFee || 0);

      const order = new Order({
        userId: userId,
        orderId: generateOrderId(),
        items: mappedItems,
        address: orderData.address,
        paymentMethod: "online",
        paymentStatus: "pending",
        orderStatus: "pending",
        subtotal: orderData.subtotal || 0,
        weight: calculateBilledWeight(orderData.weight || 0),
        shiprocketFee: finalShiprocketFee,
        taxAmount: orderData.taxAmount || 0,
        convenienceFee,
        totalAmount: finalTotalAmount,
        specialRequests: orderData.specialRequests || "",
        requestedShippingMode: mode,
        shippingMode: mode,
        shippingFallbackUsed: false,
        deliveryLat: Number.isFinite(latNum) ? latNum : undefined,
        deliveryLong: Number.isFinite(longNum) ? longNum : undefined,
        courierCompanyId:
          orderData.courierCompanyId != null
            ? String(orderData.courierCompanyId)
            : undefined,
        courierName: orderData.courierName || undefined,
        courierRate:
          orderData.courierRate != null
            ? Number(orderData.courierRate)
            : finalShiprocketFee || undefined,
        courierEtd: orderData.courierEtd || undefined,
        isLocalShiprocket: false,
      });

      try {
        await order.validate();
      } catch (e) {
        console.error(`[INSTAMOJO PAYMENT] Order validation failed:`, e.message);
        return res.status(400).json({ success: false, message: e.message });
      }

      await order.save();
      savedOrderId = order._id;
      console.log(
        `[INSTAMOJO PAYMENT] Order created with PENDING payment - orderId: ${order.orderId}, DB ID: ${order._id}`
      );

      const redirectUrl = `${SERVER_BASE_URL}/api/instamojo-callback?orderId=${order._id}`;
      const webhookUrl = `${SERVER_BASE_URL}/api/instamojo-webhook`;
      console.log(`[INSTAMOJO PAYMENT] Callback URL: ${redirectUrl}`);
      console.log(`[INSTAMOJO PAYMENT] Webhook URL: ${webhookUrl}`);

      const amountForInstamojo = Number(order.totalAmount).toFixed(2);
      // Instamojo expects 10-digit style phone when possible
      const phoneDigits = buyerPhone.replace(/\D/g, "");
      const phoneForIm =
        phoneDigits.length === 12 && phoneDigits.startsWith("91")
          ? phoneDigits.slice(2)
          : phoneDigits;

      const payload = {
        purpose: formatInstamojoPurpose(order),
        amount: amountForInstamojo,
        buyer_name: order.address?.name || user?.name || "Customer",
        email: buyerEmail,
        phone: phoneForIm,
        redirect_url: redirectUrl,
        webhook: webhookUrl,
        send_email: false,
        send_sms: false,
        allow_repeated_payments: false,
      };

      console.log(
        `[INSTAMOJO PAYMENT] Initiating Instamojo payment request - Amount: ${amountForInstamojo}`
      );

      if (BYPASS_PAYMENT_FOR_TESTING === true) {
        console.log("⚠️ [BYPASS] Bypassing Instamojo payment request creation");
        order.paymentRequestId = "REQ_MOCK";
        await order.save();
        const mockCallBackUrl = `${SERVER_BASE_URL}/api/instamojo-callback?orderId=${order._id}&payment_id=MOJO_MOCK_PAYMENT&payment_status=Credit&payment_request_id=REQ_MOCK`;
        return res.json({
          success: true,
          payment_url: mockCallBackUrl,
          payment_request_id: "REQ_MOCK",
          orderId: order._id,
          humanReadableOrderId: order.orderId,
          message: "BYPASS MODE: Redirecting directly to success callback.",
        });
      }

      const imRes = await instamojoClient.post("payment-requests/", payload);
      if (imRes.data && imRes.data.success) {
        const pr = imRes.data.payment_request;
        order.paymentRequestId = pr.id;
        await order.save();
        console.log(
          `[INSTAMOJO PAYMENT] Payment request created - Request ID: ${pr.id}, URL: ${pr.longurl}`
        );

        return res.json({
          success: true,
          payment_url: pr.longurl,
          payment_request_id: pr.id,
          orderId: order._id,
          humanReadableOrderId: order.orderId,
          message:
            "Payment initiated. User must verify payment at Instamojo before order is confirmed.",
        });
      }

      console.error(
        `[INSTAMOJO PAYMENT] Instamojo API did not return success - Response:`,
        imRes.data
      );
      await Order.deleteOne({ _id: order._id });
      savedOrderId = null;
      const msg = formatInstamojoError(
        imRes.data,
        "Failed to create Instamojo payment request"
      );
      return res.status(400).json({ success: false, message: msg });
    } catch (err) {
      console.error(
        "[INSTAMOJO PAYMENT] Unexpected error:",
        err?.response?.data || err.message || err
      );
      if (savedOrderId) {
        try {
          await Order.deleteOne({ _id: savedOrderId });
        } catch (_) {}
      }
      const msg = formatInstamojoError(
        err?.response?.data,
        err?.message || "Error creating payment request"
      );
      const status = isInstamojoClientError(err) ? 400 : 500;
      return res.status(status).json({
        success: false,
        message: msg,
      });
    }
  });

  /**
   * Instamojo server-to-server webhook (application/x-www-form-urlencoded).
   * No auth — MAC verified with INSTAMOJO_PRIVATE_SALT.
   */
  app.post("/api/instamojo-webhook", async (req, res) => {
    try {
      const data = req.body || {};
      console.log("[INSTAMOJO WEBHOOK] Received:", {
        payment_id: data.payment_id,
        payment_request_id: data.payment_request_id,
        status: data.status,
      });

      if (BYPASS_PAYMENT_FOR_TESTING !== true) {
        if (!INSTAMOJO_PRIVATE_SALT) {
          console.error(
            "[INSTAMOJO WEBHOOK] INSTAMOJO_PRIVATE_SALT is not configured"
          );
          return res.status(400).send("MAC salt not configured");
        }
        if (!verifyInstamojoMac(data, INSTAMOJO_PRIVATE_SALT)) {
          console.error("[INSTAMOJO WEBHOOK] MAC mismatch");
          return res.status(400).send("MAC mismatch");
        }
      }

      const paymentId = String(data.payment_id || "").trim();
      const paymentRequestId = String(data.payment_request_id || "").trim();
      const status = String(data.status || "").trim();

      if (!paymentRequestId) {
        console.error("[INSTAMOJO WEBHOOK] Missing payment_request_id");
        return res.status(400).send("Missing payment_request_id");
      }

      const order = await Order.findOne({ paymentRequestId });
      if (!order) {
        console.error(
          `[INSTAMOJO WEBHOOK] Order not found for paymentRequestId=${paymentRequestId}`
        );
        // 200 so Instamojo does not retry forever for unknown ids
        return res.status(200).send("OK");
      }

      if (status === "Credit") {
        let payment = {
          status: "Credit",
          amount: data.amount,
          fees: data.fees,
        };
        if (BYPASS_PAYMENT_FOR_TESTING !== true && paymentId) {
          const { verified, payment: apiPayment } =
            await verifyInstamojoPayment(paymentId);
          if (verified && apiPayment) {
            payment = apiPayment;
          } else if (!verified) {
            console.warn(
              `[INSTAMOJO WEBHOOK] API re-verify failed for ${paymentId}; trusting webhook Credit after MAC`
            );
          }
        }
        await markOrderPaidAndFulfill(order, {
          paymentId,
          paymentRequestId,
          payment,
        });
      } else if (status === "Failed") {
        await markOrderPaymentFailed(order, {
          paymentId,
          paymentRequestId,
        });
      } else {
        console.warn(`[INSTAMOJO WEBHOOK] Unhandled status: ${status}`);
      }

      return res.status(200).send("OK");
    } catch (err) {
      console.error(
        "[INSTAMOJO WEBHOOK] Error:",
        err?.response?.data || err.message || err
      );
      return res.status(500).send("Error");
    }
  });

  // Instamojo redirect callback — user lands here after payment
  app.get("/api/instamojo-callback", async (req, res) => {
    console.log("\n\n========================================");
    console.log("🔔 INSTAMOJO CALLBACK HIT!");
    console.log("========================================\n");
    try {
      const { payment_id, payment_status, payment_request_id, orderId } =
        req.query;
      console.log(`[INSTAMOJO CALLBACK] Query params:`, {
        payment_id,
        payment_status,
        payment_request_id,
        orderId,
      });

      if (!payment_id || !orderId) {
        console.error(
          "Instamojo callback: Missing parameters - payment_id:",
          payment_id,
          "orderId:",
          orderId
        );
        return res.status(400).send("Missing parameters");
      }

      console.log(
        `[INSTAMOJO CALLBACK] Processing payment_id: ${payment_id}, order: ${orderId}, status: ${payment_status}`
      );

      const order = await findOrderByIdOrOrderId(orderId);
      if (!order) {
        console.error(`[INSTAMOJO] Order not found: ${orderId}`);
        return res.redirect(
          `${CLIENT_BASE_URL}/payment-failed?orderId=${encodeURIComponent(orderId)}`
        );
      }

      const failRedirect = () =>
        res.redirect(
          `${CLIENT_BASE_URL}/payment-failed?orderId=${encodeURIComponent(order.orderId)}`
        );
      const successRedirect = () =>
        res.redirect(
          `${CLIENT_BASE_URL}/payment-success?orderId=${encodeURIComponent(order.orderId)}`
        );

      let payment = null;
      let verified = false;

      if (BYPASS_PAYMENT_FOR_TESTING === true) {
        console.log("⚠️ [BYPASS] Bypassing Instamojo payment verification logic");
        verified = true;
        payment = { status: "Credit" };
      } else {
        const result = await verifyInstamojoPayment(payment_id);
        verified = result.verified;
        payment = result.payment;
      }

      if (verified && payment && payment.status === "Credit") {
        console.log(
          `[INSTAMOJO] Payment successful (Credit). Updating order ${order.orderId}...`
        );
        await markOrderPaidAndFulfill(order, {
          paymentId: payment_id,
          paymentRequestId: payment_request_id || order.paymentRequestId,
          payment,
        });
        console.log(
          `[INSTAMOJO] Payment processing complete. Redirecting to payment-success...`
        );
        return successRedirect();
      }

      const statusHint = String(
        payment?.status || payment_status || ""
      ).trim();
      if (
        statusHint === "Failed" ||
        statusHint === "failed" ||
        !verified
      ) {
        await markOrderPaymentFailed(order, {
          paymentId: payment_id,
          paymentRequestId: payment_request_id || order.paymentRequestId,
        });
      }

      console.error(
        `[INSTAMOJO] Payment not successful. Status: ${payment?.status || payment_status}`
      );
      return failRedirect();
    } catch (err) {
      console.error(
        "[INSTAMOJO] Callback error:",
        err?.response?.data || err.message || err
      );
      return res.redirect(`${CLIENT_BASE_URL}/payment-failed`);
    }
  });

  // Get user's past orders
  app.get("/api/user/orders", authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const query = {
        userId,
        orderStatus: {
          $in: [
            "confirmed",
            "cancelled",
            "processing",
            "shipped",
            "delivered",
          ],
        },
        $or: [
          { paymentStatus: "paid" },
          { paymentMethod: "cod" },
          { paymentId: { $exists: true, $nin: [null, ""] } },
        ],
      };
      const orders = await Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalOrders = await Order.countDocuments(query);
      const totalPages = Math.ceil(totalOrders / limit);

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            currentPage: page,
            totalPages,
            totalOrders,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
      });
    } catch (error) {
      console.error("Error fetching user orders:", error);
      res.status(500).json({ success: false, message: "Failed to fetch orders" });
    }
  });
};
