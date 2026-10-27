const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const querystring = require("querystring");
const cloudinary = require("cloudinary").v2;
const {
  User,
  Cart,
  Address,
  Order,
  SellerRequest,
  Item,
  OTP,
  CancellationRequest,
} = require("../models");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { generateOTP, generateOrderId, calculateBilledWeight } = require("../utils/ids");
const { generateInvoicePDF } = require("../utils/invoice");
const { createShipmentForOrder } = require("../utils/createShipmentForOrder");
const env = require("../config/env");
const email = require("../../services/email");
const {
  instamojoClient,
  processInstamojoRefund,
} = require("../../services/instamojo");

const {
  sendSignupMail,
  sendPaymentSuccessEmail,
  sendOrderConfirmationEmail,
  sendOrderCancellationEmail,
  sendMail,
  formatIST,
  transporter,
} = email;

const SERVER_BASE_URL = env.SERVER_BASE_URL;
const CLIENT_BASE_URL = env.CLIENT_BASE_URL;
const BYPASS_PAYMENT_FOR_TESTING = env.BYPASS_PAYMENT_FOR_TESTING;
const JWT_SECRET = env.JWT_SECRET;

async function createDelhiveryPickupRequest(order) {
  console.log(`[ORDER ${order.orderId}] Delhivery pickup skipped (integration removed)`);
  return {
    success: false,
    message: "Delhivery pickup has been removed. Use Shiprocket for shipping.",
  };
}


module.exports = function registerPaymentsRoutes(app) {
app.post("/api/create-instamojo-payment", authenticateToken, async (req, res) => {
    try {
        const { orderData } = req.body;
        if (!orderData) return res.status(400).json({ success: false, message: "orderData required" });

        const userId = req.user.id;
        console.log(`[INSTAMOJO PAYMENT] Creating payment for user ${userId}, amount: ${orderData.totalAmount}`);

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

        // Create an order record with pending payment
        // Map items to preserve variant/unit info and include convenience fee if provided
        // Normalize items coming from orderData.items
        const itemsIn = (orderData.items || []);
        const mappedItems = itemsIn.map((it) => ({
            itemId: it.itemId || it.productId || null,
            name: String(it.name || ""),
            price: Number(it.price || 0),
            quantity: Number(it.quantity || 0),
            unit: String(it.unit || ""),             // always string
            variantLabel: String(it.variantLabel || ""), // always string
            sellerId: it.sellerId || null,
            sellerName: it.sellerName || "",
            tax: Number(it.tax || 0),
            discount: Number(it.discount || 0),
        }));
        const convenienceFee = Number(orderData.convenienceFee || 0);

        // STEP 1: Create an order record with PENDING payment status
        // This order will NOT be confirmed until payment is verified at Instamojo
        const order = new Order({
            userId: userId,
            orderId: generateOrderId(),
            items: mappedItems,
            address: orderData.address,
            paymentMethod: "online",
            paymentStatus: "pending",              // NOT PAID YET
            orderStatus: "pending",                // NOT CONFIRMED YET
            subtotal: orderData.subtotal || 0,
            weight: calculateBilledWeight(orderData.weight || 0),
            shiprocketFee: finalShiprocketFee,
            taxAmount: orderData.taxAmount || 0,
            convenienceFee,                        // persist fee
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
        console.log(`[INSTAMOJO PAYMENT] Order created with PENDING payment - orderId: ${order.orderId}, DB ID: ${order._id}`);

        // Get user info for buyer details
        const user = await User.findById(userId);

        // STEP 2: Build payment verification callback URL
        // Instamojo will redirect back here after payment so we can verify
        const redirectUrl = `${SERVER_BASE_URL}/api/instamojo-callback?orderId=${order._id}`;
        console.log(`[INSTAMOJO PAYMENT] Callback URL (for payment verification): ${redirectUrl}`);

        // STEP 3: Create payment request at Instamojo
        const amountForInstamojo = Number(order.totalAmount).toFixed(2);
        const payload = {
            purpose: `Order ${order.orderId}`,
            amount: amountForInstamojo,
            buyer_name: order.address?.name || user?.name || "Customer",
            email: user?.email || "",
            phone: order.address?.phone || user?.phone || "",
            redirect_url: redirectUrl,
            send_email: false,
            send_sms: false,
            allow_repeated_payments: false,
        };

        console.log(`[INSTAMOJO PAYMENT] Initiating Instamojo payment request - Amount: ${amountForInstamojo}`);

        // --- BYPASS MODE ---
        if (typeof BYPASS_PAYMENT_FOR_TESTING !== 'undefined' && BYPASS_PAYMENT_FOR_TESTING === true) {
            console.log("⚠️ [BYPASS] Bypassing Instamojo payment request creation");
            const mockCallBackUrl = `${SERVER_BASE_URL}/api/instamojo-callback?orderId=${order._id}&payment_id=MOJO_MOCK_PAYMENT&payment_status=Credit`;
            return res.json({
                success: true,
                payment_url: mockCallBackUrl,
                payment_request_id: "REQ_MOCK",
                orderId: order._id,
                humanReadableOrderId: order.orderId,
                message: "BYPASS MODE: Redirecting directly to success callback."
            });
        }
        // -------------------

        const imRes = await instamojoClient.post("payment-requests/", payload);
        if (imRes.data && imRes.data.success) {
            const pr = imRes.data.payment_request;
            console.log(`[INSTAMOJO PAYMENT] Payment request created at Instamojo - Request ID: ${pr.id}, URL: ${pr.longurl}`);

            return res.json({
                success: true,
                payment_url: pr.longurl,
                payment_request_id: pr.id,
                orderId: order._id,
                humanReadableOrderId: order.orderId,
                message: "Payment initiated. User must verify payment at Instamojo before order is confirmed."
            });
        }

        console.error(`[INSTAMOJO PAYMENT] Instamojo API did not return success - Response:`, imRes.data);
        // Delete the pending order if payment request fails
        await Order.deleteOne({ _id: order._id });
        return res.status(500).json({ success: false, message: "Failed to create Instamojo payment request" });
    } catch (err) {
        console.error("[INSTAMOJO PAYMENT] Unexpected error:", err?.response?.data || err.message || err);
        return res.status(500).json({ success: false, message: "Error creating payment request" });
    }
});

// Instamojo redirect callback - user will be redirected here after payment
// Instamojo redirect callback - user will be redirected here after payment
app.get("/api/instamojo-callback", async (req, res) => {
    console.log("\n\n========================================");
    console.log("🔔 INSTAMOJO CALLBACK HIT!");
    console.log("========================================\n");
    try {
        const { payment_id, payment_status, payment_request_id, orderId } = req.query;
        console.log(`[INSTAMOJO CALLBACK] Query params:`, { payment_id, payment_status, payment_request_id, orderId });

        if (!payment_id || !orderId) {
            console.error("Instamojo callback: Missing parameters - payment_id:", payment_id, "orderId:", orderId);
            return res.status(400).send("Missing parameters");
        }

        console.log(`[INSTAMOJO CALLBACK] Processing payment_id: ${payment_id}, order: ${orderId}, status: ${payment_status}`);

        const IS_PROD = process.env.NODE_ENV === "production";
        let payment = null;
        let verified = false;

        // --- BYPASS MODE ---
        if (typeof BYPASS_PAYMENT_FOR_TESTING !== 'undefined' && BYPASS_PAYMENT_FOR_TESTING === true) {
            console.log("⚠️ [BYPASS] Bypassing Instamojo payment verification logic");
            verified = true;
            payment = { status: "Credit" };
        }
        // -------------------

        if (!verified) { // Only attempt API verification if not bypassed
            try {
                console.log(`[INSTAMOJO] Verifying payment ${payment_id} with Instamojo API...`);
                const imRes = await instamojoClient.get(`payments/${payment_id}/`);
                payment = imRes.data?.payment || null;
                // Consider payment.status authoritative over the generic success flag
                const status = String(payment?.status || "");
                const statusOk = ["Credit", "Completed", "Success"].includes(status);
                verified = statusOk || !!(imRes.data && imRes.data.success);
                console.log(`[INSTAMOJO] API Response - success:${imRes.data?.success}, status:${status}, verified:${verified}`);
            } catch (e) {
                console.error(`[INSTAMOJO] API verification failed:`, e?.response?.data || e.message);
                verified = false;
            }

            if (!verified) { // If API verification failed, check for non-prod fallback
                if (!IS_PROD && ["Credit", "Completed", "Success"].includes(String(payment_status || ""))) {
                    console.log(`[INSTAMOJO] Non-prod mode: Accepting payment status: ${payment_status}`);
                    payment = { status: String(payment_status) };
                    verified = true;
                } else {
                    console.error(`[INSTAMOJO] Payment verification failed for order ${orderId}`);
                    return res.redirect(`${CLIENT_BASE_URL}/payment-failed?orderId=${orderId}`);
                }
            }
        }

        if (payment && (payment.status === "Credit" || payment.status === "Completed" || payment.status === "Success")) {
            console.log(`[INSTAMOJO] Payment successful (${payment.status}). Updating order ${orderId}...`);

            let order = null;
            try {
                order = await Order.findById(orderId);
            } catch (_) { }

            if (!order) {
                order = await Order.findOne({ orderId });
            }

            if (!order) {
                console.error(`[INSTAMOJO] Order not found: ${orderId}`);
                return res.redirect(`${CLIENT_BASE_URL}/payment-failed?orderId=${orderId}`);
            }

            order.paymentStatus = "paid";
            order.paymentId = payment_id;
            order.paymentRequestId = payment_request_id || order.paymentRequestId;
            order.orderStatus = "confirmed";
            order.updatedAt = new Date();
            order.paidAt = new Date();

            try {
                const feeFromApi = Number(payment?.fees || payment?.convenience_fee || 0);
                const paidAmt = Number(payment?.amount || 0);
                const baseAmt = Number(order.totalAmount || 0);
                const computedFee = feeFromApi > 0 ? feeFromApi : Math.max(0, paidAmt - baseAmt);
                if (Number.isFinite(computedFee) && computedFee > 0) {
                    order.convenienceFee = computedFee;
                }
            } catch (_) { }

            await order.save();
            console.log(`[INSTAMOJO] Order ${order.orderId} updated - Status: paid`);

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
                    console.error(`[EMAIL] Failed to send confirmation emails:`, emailError.message);
                }
            } catch (e) {
                console.error(`[SHIPROCKET] CRITICAL ERROR for ${order.orderId}:`, e?.message);
                try {
                    order.shiprocketError = `Critical error: ${e?.message}`;
                    order.shipmentStatus = "failed";
                    await order.save();
                } catch (saveError) {
                    console.error("[SHIPROCKET] Failed to save error to order:", saveError.message);
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

            console.log(
                `[SHIPROCKET] Final Status - Attempted: ${shiprocketCreationAttempted}, Success: ${shiprocketCreationSuccess}`
            );

            console.log(`[INSTAMOJO] Payment processing complete. Redirecting to payment-success...`);
            return res.redirect(`${CLIENT_BASE_URL}/payment-success?orderId=${order.orderId}`);
        }

        console.error(`[INSTAMOJO] Payment not successful. Status: ${payment?.status}`);
        return res.redirect(`${CLIENT_BASE_URL}/payment-failed?orderId=${orderId}`);
    } catch (err) {
        console.error("[INSTAMOJO] Callback error:", err?.response?.data || err.message || err);
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

        // Show paid online orders, plus COD (payment often stays pending until delivery)
        const query = {
            userId,
            orderStatus: { $in: ["confirmed", "cancelled", "processing", "shipped", "delivered"] },
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
                    hasPrevPage: page > 1
                }
            }
        });
    } catch (error) {
        console.error("Error fetching user orders:", error);
        res.status(500).json({ success: false, message: "Failed to fetch orders" });
    }
});
};
