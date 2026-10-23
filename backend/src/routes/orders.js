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


module.exports = function registerOrdersRoutes(app) {
app.post("/api/orders", authenticateToken, async (req, res) => {
    res.setHeader("X-Debug-Hit", "true");
    try {
        const {
            items,
            address,
            paymentMethod,
            paymentId,
            paymentRequestId,
            subtotal,
            shiprocketFee,
            taxAmount,
            totalAmount,
            weight,
            specialRequests,
        } = req.body;

        // Validate required fields
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Order items are required",
            });
        }

        if (!address || !address.name || !address.phone || !address.address) {
            return res.status(400).json({
                success: false,
                message: "Shiprocket address is required",
            });
        }

        if (!paymentMethod || !["cod", "online"].includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Valid payment method is required",
            });
        }

        // Generate unique order ID
        const orderId = generateOrderId();

        // Set payment status based on payment method
        let paymentStatus = "pending";
        if (paymentMethod === "cod") {
            paymentStatus = "pending"; // COD remains pending until shiprocket
        } else if (paymentMethod === "online" && paymentId) {
            paymentStatus = "paid";
        }

        // Calculate estimated shiprocket (7 days from now)
        const estimatedShiprocket = new Date();
        estimatedShiprocket.setDate(estimatedShiprocket.getDate() + 7);

        const mappedOrderItems = (items || []).map((it) => ({
            itemId: it.itemId || it.productId || null,
            name: String(it.name || ""),
            price: Number(it.price || 0),
            quantity: Number(it.quantity || 0),
            unit: String(it.unit || ""),                 // always string
            variantLabel: String(it.variantLabel || ""), // always string
            sellerId: it.sellerId || null,
            sellerName: it.sellerName || "",
            tax: Number(it.tax || 0),
            discount: Number(it.discount || 0),
        }));

        const order = new Order({
            userId: req.user.id,
            orderId,
            items: mappedOrderItems,
            address,
            paymentMethod,
            paymentStatus,
            paymentId,
            paymentRequestId,
            subtotal,
            weight: calculateBilledWeight(weight || 0),
            shiprocketFee,
            taxAmount,
            totalAmount,
            convenienceFee: Number(req.body.convenienceFee || 0), // optional for this path
            specialRequests: specialRequests || "",
            orderStatus: "confirmed",
            estimatedShiprocket,
        });



        if (paymentMethod === "cod") {
            const shippingEstimate = await getShippingEstimate(order.address.pincode, order.weight, true);
            order.shiprocketFee = shippingEstimate; // Override with real estimate
            order.totalAmount = subtotal + taxAmount + shippingEstimate; // Recalculate total
        }


        await order.save();

        // Clear user's cart after successful order
        try {
            await Cart.deleteOne({ userId: req.user.id });
        } catch (cartError) {
            console.error("Failed to clear cart after order:", cartError);
            // Don't fail the order if cart clearing fails
        }

        // Send order confirmation email
        // Send order confirmation email only after payment confirmed
        try {
            const user = await User.findById(req.user.id);
            if (order.paymentStatus === "paid") {
                await sendOrderConfirmationEmail(user, order);
            }
        } catch (emailError) {
            console.error("Failed to send order confirmation email:", emailError);
            // Don't fail the order creation if email fails
        }









        // ✅ 1️⃣ Create Shipment in Shiprocket right here
        // Only create shipment for non-local deliveries (COD is confirmed immediately)
        const isLocalDelivery = shouldUseInstamojoForPincode(order.address.pincode);
        if (isLocalDelivery) {
            console.log(`ℹ️ [SKIP SHIPROCKET] Pincode ${order.address.pincode} is in LOCAL NCR region. Shiprocket order creation skipped.`);
        }

        if (!isLocalDelivery && (order.paymentMethod === "cod" || order.paymentStatus === "paid")) {
            console.log(`Creating Shiprocket shipment for order ${order.orderId}, pincode: ${order.address.pincode}`);
            try {
                // Ensure unique SKUs per order to avoid 'SKU cannot be repeated' from Shiprocket
                const skuCountMap = new Map();
                const makeUniqueSku = (base) => {
                    const key = String(base || "SKU-ITEM");
                    const count = (skuCountMap.get(key) || 0) + 1;
                    skuCountMap.set(key, count);
                    return count === 1 ? key : `${key}-${count}`;
                };

                const shiprocketResult = await shiprocket.createShiprocketOrder({
                    orderId: order.orderId,
                    billingCustomerName: order.address.name,
                    billingEmail: req.user.email,
                    billingPhone: order.address.phone,
                    billingAddress: order.address.address,
                    billingCity: order.address.city,
                    billingPincode: order.address.pincode,
                    billingState: order.address.state,
                    paymentMethod: order.paymentMethod === "cod" ? "COD" : "Prepaid",
                    subtotal: order.subtotal,
                    weight: order.weight,
                    shippingCharges: order.shiprocketFee,
                    transactionCharges: (Number(order.convenienceFee || 0) * 1.18),
                    items: order.items.map(item => ({
                        name: item.name,
                        sku: makeUniqueSku(item.itemId || item.name),
                        quantity: item.quantity,
                        price: item.price,
                        tax: item.tax,
                        discount: item.discount
                    }))
                });

                if (shiprocketResult.success) {
                    order.shiprocketOrderId = shiprocketResult.shiprocketOrderId;
                    order.shipmentStatus = "created";
                    order.shiprocketError = null;
                    await order.save();
                    console.log(`Shiprocket order created: ${shiprocketResult.shiprocketOrderId}`);
                } else {
                    order.shiprocketError = shiprocketResult.error;
                    await order.save();
                    console.error("Shiprocket creation failed:", shiprocketResult.error);
                }
            } catch (shipmentError) {
                console.error(`[ORDER ${order.orderId}] Shiprocket API Error:`, shipmentError.message);
            }
        } else if (shouldUseInstamojoForPincode(order.address.pincode)) {
            // Local shiprocket pincode
            order.isLocalShiprocket = true;
            order.shipmentStatus = "na";
            await order.save();
            console.log(`[ORDER ${order.orderId}] Local delivery (Instamojo region) - Shiprocket not required`);
        }















        // Mock addresss


        // try {
        //   const MOCK_DELHIVERY = true;  

        //   let awb = null;
        //   let shipmentDetails = {};

        //   if (MOCK_DELHIVERY) {

        //     awb = `TESTAWB${Date.now()}${Math.floor(Math.random() * 10000)}`;  
        //     shipmentDetails = {
        //       success: true,
        //       upload_wbn: awb,
        //       packages: [{ waybill: awb }],
        //       status: "In Progress",  
        //     };
        //     console.log("✅ MOCK Delhivery Shipment Created:", awb);
        //   } else {

        //     const DELHIVERY_TOKEN = process.env.DELHIVERY_TOKEN || "889a0fe85153498399f843c01b8bda62790a68ac";
        //     const DELHIVERY_URL = "https://track.delhivery.com/api/cmu/create.json";

        //     const shipmentData = {
        //       shipments: [
        //         {
        //           add: order.address.address,
        //           city: order.address.city,
        //           pin: order.address.pincode,
        //           state: order.address.state,
        //           country: "India",
        //           name: order.address.name,
        //           phone: order.address.phone,
        //           order: order.orderId,
        //           payment_mode: order.paymentMethod === "cod" ? "COD" : "Prepaid",
        //           product_details: order.items.map((i) => i.name).join(", "),
        //           cod_amount: order.paymentMethod === "cod" ? order.totalAmount : 0,
        //           weight: 1,
        //           seller_gst_tin: "29ABCDE1234F1Z5",
        //           hsn_code: ["8471"],
        //         },
        //       ],
        //       pickup_location: {
        //         name: "Kanwarji Chandni Chowk", 
        //         add: "CHANDNI, CHOWK",
        //         city: "Delhi",
        //         pin: "110006", 
        //         country: "India",
        //         phone: "+91-9811049585",
        //       },

        //     };

        //     const querystring = require('querystring');
        //     const encodedPayload = querystring.stringify({
        //       format: "json",
        //       data: JSON.stringify(shipmentData),
        //     });

        //     const delhiveryResponse = await axios.post(DELHIVERY_URL, encodedPayload, {
        //       headers: {
        //         Authorization: `Token ${DELHIVERY_TOKEN}`,
        //         "Content-Type": "application/x-www-form-urlencoded",
        //       },
        //     });

        //     console.log("Full Delhivery Response:", JSON.stringify(delhiveryResponse.data, null, 2));

        //     awb = delhiveryResponse.data?.upload_wbn || delhiveryResponse.data?.waybill || null;
        //     shipmentDetails = delhiveryResponse.data;

        //     if (awb && delhiveryResponse.data.success) {
        //       console.log("✅ Delhivery Shipment Created:", awb);
        //     } else {
        //       console.error("❌ No AWB:", delhiveryResponse.data.rmk || "Unknown error");
        //     }
        //   }


        //   if (awb) {
        //     order.awbNumber = awb;
        //     order.orderStatus = "shipped";
        //     order.shipmentStatus = "shipped";
        //     order.shipmentDetails = shipmentDetails;
        //     await order.save();
        //   }
        // } catch (shipmentError) {
        //   console.error("Delhivery shipment error:", shipmentError.response?.data || shipmentError.message);

        // }

























        res.status(201).json({
            success: true,
            message: "Order placed successfully!",
            order_id: order.orderId,
            order: {
                id: order._id,
                orderId: order.orderId,
                totalAmount: order.totalAmount,
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus,
                estimatedShiprocket: order.estimatedShiprocket,
                specialRequests: order.specialRequests, // Include in response
                createdAt: order.createdAt,
            },
        });
    } catch (error) {
        console.error("Create order error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create order",
        });
    }
});

app.get(
    "/api/orders/:orderId/shipment-status",
    authenticateToken,
    async (req, res) => {
        try {
            const order = await Order.findOne({ orderId: req.params.orderId });
            if (!order) return res.status(404).json({ error: "Order not found" });

            if (!order.awbNumber) return res.json({ status: "Not yet shipped" });

            // Use Shiprocket tracking
            const result = await shiprocket.trackShipment(order.awbNumber);

            if (result.success) {
                // Update internal status if available
                const srStatus = result.data?.tracking_data?.shipment_track?.[0]?.current_status;
                if (srStatus && order.shipmentStatus !== srStatus) {
                    order.shipmentStatus = srStatus.toLowerCase();
                    if (srStatus.toLowerCase() === "delivered") order.orderStatus = "delivered";
                    await order.save();
                }
                res.json({
                    orderId: order.orderId,
                    shiprocketOrderId: order.awbNumber,
                    currentStatus: srStatus || "In Transit",
                    details: result.data
                });
            } else {
                res.status(400).json({ error: "Failed to fetch Shiprocket tracking", message: result.error });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);


app.get("/api/orders", authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const query = {}; // Filter by user ID

        if (status) {
            query.orderStatus = status;
        }

        const orders = await Order.find(query)
            .populate("userId", "name email phone")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: Number.parseInt(page),
            totalOrders: total,
        });
    } catch (error) {
        console.error("Get orders error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
        });
    }
});



















// Get single order
app.get("/api/orders/:orderId", authenticateToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.user.id,
        });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }
        res.json({
            success: true,
            order,
        });
    } catch (error) {
        console.error("Get order error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch order",
        });
    }
});

app.post("/api/orders/:orderId/create-pickup", authenticateToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            orderId: req.params.orderId,
            userId: req.user.id,
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Check if shipment was already created
        if (!order.awbNumber) {
            return res.status(400).json({
                success: false,
                message: "Shipment not yet created. Please wait for shipment creation before creating pickup request."
            });
        }

        // Create the pickup request
        const pickupResult = await createDelhiveryPickupRequest(order);

        if (pickupResult.success) {
            // Update order with pickup info
            order.pickupRequestId = pickupResult.pickupId;
            order.pickupStatus = pickupResult.status || "created";
            order.pickupRequestError = "";
            await order.save();

            return res.json({
                success: true,
                message: "Pickup request created successfully",
                pickupId: pickupResult.pickupId,
                status: pickupResult.status
            });
        } else {
            // Save error but don't fail the order
            order.pickupRequestError = pickupResult.message;
            await order.save();

            return res.status(400).json({
                success: false,
                message: pickupResult.message,
                error: pickupResult.error
            });
        }
    } catch (error) {
        console.error("Create pickup error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create pickup request",
            error: error.message
        });
    }
});

// API: Auto-generate pickup request when order is confirmed (optional bulk endpoint)
app.post("/api/orders/generate-pickups/bulk", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { orderIds } = req.body;

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of orderIds"
            });
        }

        const orders = await Order.find({
            orderId: { $in: orderIds }
        });

        const results = [];

        for (const order of orders) {
            // Only generate pickup for orders with shipments
            if (!order.awbNumber) {
                results.push({
                    orderId: order.orderId,
                    success: false,
                    message: "No shipment created yet"
                });
                continue;
            }

            const pickupResult = await createDelhiveryPickupRequest(order);

            if (pickupResult.success) {
                order.pickupRequestId = pickupResult.pickupId;
                order.pickupStatus = pickupResult.status || "created";
                order.pickupRequestError = "";
                await order.save();

                results.push({
                    orderId: order.orderId,
                    success: true,
                    pickupId: pickupResult.pickupId,
                    status: pickupResult.status
                });
            } else {
                order.pickupRequestError = pickupResult.message;
                await order.save();

                results.push({
                    orderId: order.orderId,
                    success: false,
                    message: pickupResult.message
                });
            }
        }

        res.json({
            success: true,
            message: "Pickup request generation complete",
            results: results,
            summary: {
                total: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        });

    } catch (error) {
        console.error("Bulk pickup generation error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate pickup requests",
            error: error.message
        });
    }
});

// Send order cancellation email
async function sendOrderCancellationEmail(user, order, cancellationReason) {
    const itemsList = order.items
        .map(
            (item) =>
                `<tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${item.name}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.quantity}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">₹${item.price}</td>
                </tr>`
        )
        .join("");

    const refundInfo = order.paymentMethod === "online" && order.paymentStatus === "paid"
        ? `
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
              <h3 style="margin: 0 0 12px 0; color: #856404; font-size: 16px;">Refund Information</h3>
              <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your payment of <strong>₹${order.totalAmount}</strong> will be refunded to your original payment method.</p>
              <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Refund processing typically takes 3-5 business days.</p>
            </div>
          `
        : ``;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: `Order Cancelled - ${order.orderId}`,
        html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f9f9f9;">
        <!-- Cancellation Banner -->
        <div style="background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); padding: 30px; text-align: center; color: white;">
          <div style="font-size: 48px; margin-bottom: 10px;">✗</div>
          <h2 style="margin: 0; font-size: 28px; font-weight: bold;">Order Cancelled</h2>
        </div>

        <!-- Main Content -->
        <div style="padding: 30px; background-color: white;">
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">Hello <strong>${user.name}</strong>,</p>
          <p style="margin: 0 0 25px 0; font-size: 14px; color: #666; line-height: 1.6;">Your order has been successfully cancelled. Here are the details:</p>

          <!-- Cancellation Details -->
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #f44336;">
            <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Cancellation Details</h3>
            <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Order ID:</strong> ${order.orderId}</p>
          <p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Cancellation Date & Time:</strong> ${formatIST(order.cancelledAt || order.updatedAt || order.createdAt)}</p>
            ${cancellationReason ? `<p style="margin: 8px 0; color: #666; font-size: 14px;"><strong>Reason:</strong> ${cancellationReason}</p>` : ""}
          </div>

          <!-- Order Summary -->
          <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Order Summary</h3>
          <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 12px; text-align: left; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Item</th>
                <th style="padding: 12px; text-align: center; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 12px; text-align: right; color: #333; font-weight: bold; border-bottom: 2px solid #ddd;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
          </table>

          <!-- Cost Breakdown -->
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
  <p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;">
    <span>Subtotal:</span> <strong>₹${Number(order.subtotal || 0).toFixed(2)}</strong>
  </p>
  ${order.taxAmount ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Tax:</span> <strong>₹${Number(order.taxAmount || 0).toFixed(2)}</strong></p>` : ""}
  ${order.shiprocketFee ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Shiprocket Fee:</span> <strong>₹${Number(order.shiprocketFee || 0).toFixed(2)}</strong></p>` : ""}
 ${order.convenienceFee ? `<p style="margin: 8px 0; color: #666; font-size: 14px; display: flex; justify-content: space-between;"><span>Convenience Fee:</span> <strong>₹${(Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</strong></p>` : ""}
  <p style="margin: 12px 0 0 0; padding-top: 12px; border-top: 2px solid #ddd; color: #333; font-size: 16px; display: flex; justify-content: space-between;">
    <span><strong>Total:</strong></span> <strong style="color: #d32f2f;">₹${(Number(order.totalAmount || 0) + Number(order.convenienceFee || 0) * 1.18).toFixed(2)}</strong>
  </p>
</div>

          <!-- Refund Information -->
          ${refundInfo}

          <!-- Next Steps -->
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px 0; color: #1565c0; font-size: 16px;">What Happens Next?</h3>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your order has been removed from processing</p>
            <p style="margin: 8px 0; color: #333; font-size: 14px;">✓ No shipment will be sent for this order</p>
            ${order.paymentMethod === "online" && order.paymentStatus === "paid" ? `<p style="margin: 8px 0; color: #333; font-size: 14px;">✓ Your refund will be processed within 3-5 business days</p>` : ""}
          </div>

          <!-- Support -->
          <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.6;">
            If you have any questions about your cancellation, please don't hesitate to <strong>contact us</strong>. We're here to help!
          </p>

          <p style="margin: 0; font-size: 14px; color: #999;">We hope to serve you again in the future.</p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0;">
          <p style="margin: 0; font-size: 12px; color: #999;">
            This is an automated email. Please do not reply directly to this email.<br>
            For support, visit our website or contact us at kanwarji@rpdindia.com
          </p>
        </div>
      </div>
    `,
    };
    await sendMail(mailOptions);
}

// Request order cancellation - Creates a request that admin must approve/reject
app.post(
    "/api/orders/:orderId/request-cancellation",
    authenticateToken,
    async (req, res) => {
        try {
            const { reason } = req.body;
            const orderId = req.params.orderId;

            if (!reason || reason.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Cancellation reason is required",
                });
            }

            // Try to find by orderId or MongoDB _id
            let order = await Order.findOne({
                orderId: orderId,
                userId: req.user.id,
            });

            if (!order) {
                order = await Order.findOne({
                    _id: orderId,
                    userId: req.user.id,
                });
            }

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            // Check if order can be cancelled (only pending, confirmed, and processing orders can be cancelled)
            const cancelleableStatuses = ["pending", "confirmed", "processing"];
            if (!cancelleableStatuses.includes(order.orderStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Order with status '${order.orderStatus}' cannot be cancelled. Only pending, confirmed, or processing orders can be cancelled.`,
                });
            }

            // Check if there's already a pending cancellation request
            const existingRequest = await CancellationRequest.findOne({
                orderId: order._id,
                status: "pending"
            });

            if (existingRequest) {
                return res.status(400).json({
                    success: false,
                    message: "A cancellation request for this order is already pending admin review",
                });
            }

            // Get user details
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            // Create cancellation request
            const cancellationRequest = new CancellationRequest({
                orderId: order._id,
                userId: req.user.id,
                orderIdStr: order.orderId,
                customerName: user.name || "Not provided",
                customerEmail: user.email,
                customerPhone: user.phone || "Not provided",
                cancellationReason: reason,
                status: "pending",
                totalAmount: order.totalAmount,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                paymentId: order.paymentId || "",
                items: order.items || [],
                // Prefer the standard `address` saved on the order, fall back to shiprocketAddress
                address: order.address || order.shiprocketAddress || {},
            });

            await cancellationRequest.save();

            // Update order status to mark it as having a pending cancellation request
            order.orderStatus = "cancellation-pending";
            order.updatedAt = new Date();
            await order.save();

            // Send confirmation email to user
            try {
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: `Cancellation Request Received - Order #${order.orderId}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                            <div style="background-color: #fff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #333; text-align: center;">Cancellation Request Received</h2>
                                <p style="color: #666; font-size: 14px;">Hi ${user.name},</p>
                                <p style="color: #666; font-size: 14px;">We have received your cancellation request for order <strong>#${order.orderId}</strong>.</p>
                                
                                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                                    <p style="margin: 0; color: #856404; font-size: 14px;"><strong>⏳ Status: Under Review</strong></p>
                                    <p style="margin: 8px 0; color: #856404; font-size: 14px;">Your request is now being reviewed by our admin team. You will receive an email notification once it's approved or rejected.</p>
                                </div>

                                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <p style="margin: 0; color: #666; font-size: 14px;"><strong>Order Details:</strong></p>
                                    <p style="margin: 8px 0; color: #666; font-size: 14px;">Order ID: ${order.orderId}</p>
                                    <p style="margin: 8px 0; color: #666; font-size: 14px;">Order Total: ₹${order.totalAmount.toFixed(2)}</p>
                                    <p style="margin: 8px 0; color: #666; font-size: 14px;">Cancellation Reason: ${reason}</p>
                                </div>

                                ${order.paymentMethod === "online" && order.paymentStatus === "paid" ? `
                                    <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid green;">
                                        <p style="margin: 0; color: #2e7d32; font-size: 14px;"><strong>Refund Information:</strong></p>
                                        <p style="margin: 8px 0; color: #2e7d32; font-size: 14px;">If your cancellation is approved, your refund of ₹${order.totalAmount.toFixed(2)} will be processed to your original payment method within 3-5 business days.</p>
                                    </div>
                                ` : ""}

                                <p style="color: #666; font-size: 14px; margin-top: 20px;">Thank you for your patience. We appreciate your business.</p>
                                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">This is an automated email. Please do not reply directly.</p>
                            </div>
                        </div>
                    `,
                };
                await sendMail(mailOptions);
            } catch (emailError) {
                console.error("Failed to send cancellation request confirmation email:", emailError);
            }

            res.json({
                success: true,
                message: "Cancellation request submitted successfully. Our admin team will review it shortly.",
                orderId: order.orderId,
                orderStatus: "cancellation-pending",
                requestId: cancellationRequest._id,
            });
        } catch (error) {
            console.error("Request cancellation error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to submit cancellation request",
            });
        }
    }
);

// Cancel order - Immediately cancels and processes refunds
app.patch(
    "/api/orders/:orderId/cancel",
    authenticateToken,
    async (req, res) => {
        try {
            const { reason } = req.body;
            const orderId = req.params.orderId;

            // Try to find by orderId or MongoDB _id
            let order = await Order.findOne({
                orderId: orderId,
                userId: req.user.id,
            });

            if (!order) {
                order = await Order.findOne({
                    _id: orderId,
                    userId: req.user.id,
                });
            }

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            // Check if order can be cancelled (only pending, confirmed, and processing orders can be cancelled)
            const cancelleableStatuses = ["pending", "confirmed", "processing"];
            if (!cancelleableStatuses.includes(order.orderStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Order with status '${order.orderStatus}' cannot be cancelled. Only pending, confirmed, or processing orders can be cancelled.`,
                });
            }

            // Check if order is already cancelled
            if (order.orderStatus === "cancelled") {
                return res.status(400).json({
                    success: false,
                    message: "This order is already cancelled",
                });
            }

            // Immediately cancel the order
            order.orderStatus = "cancelled";
            order.cancelledAt = new Date();
            order.cancellationReason = reason || "Cancelled by user";
            order.cancellationInitiatedBy = "user";
            order.updatedAt = new Date();

            // Process refund if payment was made online
            let refundResult = null;
            if (order.paymentMethod === "online" && order.paymentStatus === "paid") {
                order.paymentStatus = "refunded";
                order.refundedAt = new Date();
                console.log(`Processing Instamojo refund for user-cancelled order ${order.orderId}`);
                refundResult = await processInstamojoRefund(order);

                if (!refundResult.success && !refundResult.skipped) {
                    console.error(`Refund processing warning: ${refundResult.error}`);
                    // Still save the cancellation even if refund processing has issues
                }
            }

            await order.save();

            // Send cancellation email to user
            try {
                const user = await User.findById(req.user.id);
                if (user) {
                    await sendOrderCancellationEmail(user, order, reason);
                }
            } catch (emailError) {
                console.error("Failed to send cancellation email:", emailError);
                // Don't fail the operation if email fails
            }

            res.json({
                success: true,
                message: "Order cancelled successfully. Refund will be processed within 5-7 business days.",
                orderId: order.orderId,
                orderStatus: order.orderStatus,
                cancelledAt: order.cancelledAt,
                refundInfo: refundResult ? {
                    status: refundResult.success ? "processed" : "pending",
                    message: refundResult.success
                        ? "Refund request submitted to payment gateway"
                        : "Refund will be processed manually"
                } : null
            });
        } catch (error) {
            console.error("Cancel order error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to cancel order",
            });
        }
    }
);

// =============================================================================
// USER CANCELLATION REQUEST APIs
// =============================================================================

// Get user's cancellation requests
app.get(
    "/api/user/cancellation-requests",
    authenticateToken,
    async (req, res) => {
        try {
            const { status = "all", page = 1, limit = 10 } = req.query;

            const query = { userId: req.user.id };

            // Filter by status
            if (status && status !== "all") {
                query.status = status;
            }

            const requests = await CancellationRequest.find(query)
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await CancellationRequest.countDocuments(query);

            res.json({
                success: true,
                data: {
                    requests,
                    totalPages: Math.ceil(total / limit),
                    currentPage: Number.parseInt(page),
                    totalRequests: total,
                },
            });
        } catch (error) {
            console.error("Get user cancellation requests error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch cancellation requests",
            });
        }
    }
);

// Get single user's cancellation request details
app.get(
    "/api/user/cancellation-requests/:id",
    authenticateToken,
    async (req, res) => {
        try {
            const request = await CancellationRequest.findOne({
                _id: req.params.id,
                userId: req.user.id,
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: "Cancellation request not found",
                });
            }

            res.json({
                success: true,
                data: request,
            });
        } catch (error) {
            console.error("Get user cancellation request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch cancellation request",
            });
        }
    }
);

// =============================================================================
// CANCELLATION REQUEST MANAGEMENT APIs (ADMIN)
// =============================================================================

};
