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
const { shouldUseInstamojoForPincode, getShippingEstimate } = require("../utils/pincode");
const { generateInvoicePDF } = require("../utils/invoice");
const env = require("../config/env");
const email = require("../../services/email");
const {
  instamojoClient,
  processInstamojoRefund,
} = require("../../services/instamojo");
const shiprocket = require("../../services/shiprocket");

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

        // Check if pincode is in Instamojo region
        let finalShiprocketFee = orderData.shiprocketFee || 0;
        let finalTotalAmount = orderData.totalAmount || 0;

        const pincode = orderData.address?.pincode;
        if (shouldUseInstamojoForPincode(pincode)) {
            // Pincode is in Instamojo region - bypass Shiprocket and set shipping to ZERO
            console.log(`[INSTAMOJO PAYMENT] Pincode ${pincode} is in Instamojo region - Setting shipping to ZERO`);
            finalShiprocketFee = 0;
            // Recalculate totalAmount: subtotal + 0 shipping + tax
            finalTotalAmount = (orderData.subtotal || 0) + 0 + (orderData.taxAmount || 0);
        } else {
            // Pincode is NOT in Instamojo region - use Shiprocket shipping that's already in orderData
            console.log(`[INSTAMOJO PAYMENT] Pincode ${pincode} is NOT in Instamojo region - Using Shiprocket shipping`);
        }

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
        const payload = {
            purpose: `Order ${order.orderId}`,
            amount: String(order.totalAmount),
            buyer_name: order.address?.name || user?.name || "Customer",
            email: user?.email || "",
            phone: order.address?.phone || user?.phone || "",
            redirect_url: redirectUrl,
            send_email: false,
            send_sms: false,
            allow_repeated_payments: false,
        };

        console.log(`[INSTAMOJO PAYMENT] Initiating Instamojo payment request - Amount: ${order.totalAmount}`);

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

            // ✅ Automatically create Shiprocket Order after payment using the working API endpoint
            // NOTE: Using /api/shiprocket/create-order endpoint which is tested and working in Postman
            let shiprocketCreationAttempted = false;
            let shiprocketCreationSuccess = false;

            try {
                console.log("\n========================================");
                console.log("🚀 [SHIPROCKET] STARTING ORDER CREATION VIA API");
                console.log("========================================");
                console.log(`[SHIPROCKET] Order ID: ${order.orderId}`);
                console.log(`[SHIPROCKET] Order DB ID: ${order._id}`);
                console.log(`[SHIPROCKET] Payment Status: ${order.paymentStatus}`);
                console.log(`[SHIPROCKET] Order Status: ${order.orderStatus}`);

                const user = await User.findById(order.userId);
                if (!user) {
                    console.error(`[SHIPROCKET] User not found for userId: ${order.userId}`);
                    throw new Error(`User not found for userId: ${order.userId}`);
                }

                console.log(`[SHIPROCKET] User found: ${user.email}`);
                console.log(`[SHIPROCKET] Delivery Address: ${order.address?.city || 'N/A'}, ${order.address?.state || 'N/A'}, ${order.address?.pincode || 'N/A'}`);
                console.log(`[SHIPROCKET] Items Count: ${order.items?.length || 0}`);
                console.log(`[SHIPROCKET] Total Weight: ${order.weight || 0.5} kg`);

                // Helper function to get safe value with fallback
                const safeValue = (value, fallback) => {
                    if (value === null || value === undefined || String(value).trim() === '') {
                        return fallback;
                    }
                    return value;
                };

                // Split name into first and last name
                const fullName = safeValue(order.address?.name, "Customer");
                const nameParts = fullName.trim().split(' ');
                const firstName = nameParts[0] || "Customer";
                const lastName = nameParts.slice(1).join(' ') || "Name";

                // Prepare the payload matching the working Postman format
                // Use our platform orderId directly for Shiprocket order_id to keep it consistent everywhere
                const shiprocketOrderId = order.orderId;

                // Recompute billed weight from items if available; fallback to order.weight
                let computedTotalWeight = 0;
                if (Array.isArray(order.items)) {
                    for (const it of order.items) {
                        const w = parseFloat(it?.weight);
                        const q = Number(it?.quantity) || 0;
                        if (!isNaN(w) && w > 0 && q > 0) {
                            computedTotalWeight += w * q;
                        }
                    }
                }
                let billedW = computedTotalWeight > 0
                    ? calculateBilledWeight(computedTotalWeight)
                    : (Number(order.weight) || 0.5);
                // Keep order.weight consistent for downstream usage and persistence on next save
                order.weight = billedW;
                let boxLen = 10, boxBr = 10, boxHt = 6; // default upto 1kg
                if (billedW <= 1) {
                    boxLen = 10; boxBr = 10; boxHt = 6;
                } else if (billedW <= 2) {
                    boxLen = 15; boxBr = 15; boxHt = 10;
                } else if (billedW <= 3) {
                    boxLen = 18; boxBr = 18; boxHt = 10;
                } else if (billedW <= 4) {
                    boxLen = 20; boxBr = 20; boxHt = 12;
                } else { // upto 5 Kgs (and above default)
                    boxLen = 24; boxBr = 20; boxHt = 15;
                }

                // Ensure unique SKUs per order as Shiprocket rejects repeated SKUs
                const skuCountMapCb = new Map();
                const makeUniqueSkuCb = (base) => {
                    const key = String(base || "SKU-001");
                    const count = (skuCountMapCb.get(key) || 0) + 1;
                    skuCountMapCb.set(key, count);
                    return count === 1 ? key : `${key}-${count}`;
                };

                const apiPayload = {
                    orderId: shiprocketOrderId,
                    orderData: {
                        billingCustomerName: firstName,
                        billingLastName: lastName,
                        billingEmail: safeValue(user.email, "customer@example.com"),
                        billingPhone: safeValue(order.address?.phone, "9999999999"),
                        billingAddress: safeValue(order.address?.address, "Address not provided"),
                        billingCity: safeValue(order.address?.city, "Mumbai"),
                        billingPincode: safeValue(order.address?.pincode, "400001"),
                        billingState: safeValue(order.address?.state, "Maharashtra"),
                        billingCountry: "India",
                        shippingIsBilling: true,
                        paymentMethod: "Prepaid",
                        subtotal: Number(order.subtotal) || 100,
                        shippingCharges: Number(order.shiprocketFee) || 0,
                        transactionCharges: Number(order.convenienceFee || 0) * 1.18,
                        weight: billedW,
                        length: boxLen,
                        breadth: boxBr,
                        height: boxHt,
                        items: (order.items || []).map(item => {
                            const baseSku = safeValue(item.itemId || item.name, "SKU-001");
                            const uniqueSku = makeUniqueSkuCb(baseSku);
                            return {
                                name: safeValue(item.name, "Product"),
                                sku: uniqueSku,
                                quantity: Number(item.quantity) || 1,
                                price: Number(item.price) || 0,
                                discount: Number(item.discount) || 0,
                                tax: Number(item.tax) || 0
                            };
                        })
                    }
                };

                // Ensure at least one item exists
                if (apiPayload.orderData.items.length === 0) {
                    apiPayload.orderData.items.push({
                        name: "Order Item",
                        sku: "ITEM-001",
                        quantity: 1,
                        price: Number(order.subtotal) || 100,
                        discount: 0,
                        tax: 0
                    });
                }

                console.log("[SHIPROCKET] API Payload prepared:");
                console.log(JSON.stringify(apiPayload, null, 2));
                console.log("[SHIPROCKET] Calling /api/shiprocket/create-order endpoint...");

                shiprocketCreationAttempted = true;

                // Call Shiprocket service directly to avoid internal HTTP self-calls and timeouts
                try {
                    console.log("[SHIPROCKET] Calling service.createShiprocketOrder directly...");
                    const srResult = await shiprocket.createShiprocketOrder({
                        orderId: apiPayload.orderId,
                        ...apiPayload.orderData,
                    });

                    console.log("[SHIPROCKET] Service Response received:");
                    console.log(JSON.stringify(srResult, null, 2));

                    if (srResult && srResult.success) {
                        order.shiprocketOrderId = srResult.shiprocketOrderId || shiprocketOrderId;
                        order.shipmentStatus = "created";
                        order.shiprocketError = null;
                        await order.save();
                        shiprocketCreationSuccess = true;

                        console.log("========================================");
                        console.log(`✅ [SHIPROCKET] ORDER CREATED SUCCESSFULLY`);
                        console.log(`   Shiprocket Order ID: ${srResult.shiprocketOrderId}`);
                        console.log(`   Our Order ID: ${order.orderId}`);
                        console.log("========================================\n");
                    } else {
                        const errorMsg = srResult?.error || "Unknown error from Shiprocket service";
                        order.shiprocketError = errorMsg;
                        order.shipmentStatus = "failed";
                        await order.save();

                        console.log("========================================");
                        console.error(`❌ [SHIPROCKET] ORDER CREATION FAILED`);
                        console.error(`   Order ID: ${order.orderId}`);
                        console.error(`   Error: ${errorMsg}`);
                        console.error(`   Full Response: ${JSON.stringify(srResult, null, 2)}`);
                        console.log("========================================\n");
                    }
                } catch (apiError) {
                    const errorMsg = apiError.response?.data?.error || apiError.response?.data?.message || apiError.message || "Shiprocket service call failed";
                    order.shiprocketError = errorMsg;
                    order.shipmentStatus = "failed";
                    await order.save();

                    console.log("========================================");
                    console.error(`❌ [SHIPROCKET] SERVICE CALL FAILED`);
                    console.error(`   Order ID: ${order.orderId}`);
                    console.error(`   Error: ${errorMsg}`);
                    console.error(`   Stack: ${apiError.stack}`);
                    console.log("========================================\n");
                }

                // Send emails regardless of Shiprocket status
                try {
                    await sendPaymentSuccessEmail(user, order);
                    await sendOrderConfirmationEmail(user, order);
                    console.log(`[EMAIL] Confirmation emails sent to ${user.email}`);
                } catch (emailError) {
                    console.error(`[EMAIL] Failed to send confirmation emails:`, emailError.message);
                    // Don't throw - email failure shouldn't block the order
                }

            } catch (e) {
                console.log("========================================");
                console.error("❌ [SHIPROCKET] CRITICAL ERROR");
                console.error(`   Order ID: ${order.orderId}`);
                console.error(`   Error Message: ${e?.message}`);
                console.error(`   Error Stack: ${e?.stack}`);
                console.log("========================================\n");

                // Save error to order
                try {
                    order.shiprocketError = `Critical error: ${e?.message}`;
                    order.shipmentStatus = "failed";
                    await order.save();
                } catch (saveError) {
                    console.error("[SHIPROCKET] Failed to save error to order:", saveError.message);
                }

                // Still try to send emails even if Shiprocket failed
                try {
                    const user = await User.findById(order.userId);
                    if (user) {
                        await sendPaymentSuccessEmail(user, order);
                        await sendOrderConfirmationEmail(user, order);
                        console.log(`[EMAIL] Confirmation emails sent despite Shiprocket failure`);
                    }
                } catch (emailError) {
                    console.error(`[EMAIL] Failed to send emails:`, emailError.message);
                }
            }

            // Log final status
            console.log(`[SHIPROCKET] Final Status - Attempted: ${shiprocketCreationAttempted}, Success: ${shiprocketCreationSuccess}`);

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

        // Only show paid orders that are confirmed or cancelled
        const query = {
            userId,
            paymentStatus: "paid",
            orderStatus: { $in: ["confirmed", "cancelled"] }
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
