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


module.exports = function registerShiprocketRoutes(app) {
app.post("/api/shiprocket/create-order", async (req, res) => {
    try {
        const { orderId, orderData } = req.body;

        if (!orderId || !orderData) {
            return res.status(400).json({
                success: false,
                message: "Order ID and order data are required",
            });
        }

        // Validate items array early to avoid undefined.map crashes in service layer
        const itemsArr = Array.isArray(orderData?.items)
            ? orderData.items
            : (Array.isArray(orderData?.order_items) ? orderData.order_items : []);
        if (!Array.isArray(itemsArr) || itemsArr.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Order items array is required and cannot be empty",
            });
        }

        const result = await shiprocket.createShiprocketOrder({
            orderId,
            ...orderData,
        });

        if (result.success) {
            res.json({
                success: true,
                message: "Order created on Shiprocket successfully",
                shiprocketOrderId: result.shiprocketOrderId,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to create Shiprocket order",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error creating Shiprocket order:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Get Shipping Rates
app.post("/api/shiprocket/shipping-rates", authenticateToken, async (req, res) => {
    try {
        const { pickupLocationId, deliveryPincode, weight, orderValue } = req.body;

        if (!pickupLocationId || !deliveryPincode) {
            return res.status(400).json({
                success: false,
                message: "Pickup location ID and delivery pincode are required",
            });
        }

        const result = await shiprocket.getShippingRate(
            pickupLocationId,
            deliveryPincode,
            weight || 1,
            orderValue || 0
        );

        if (result.success) {
            res.json({
                success: true,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to fetch shipping rates",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error fetching shipping rates:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Track Shipment (Public - allows guest tracking)
app.get("/api/shiprocket/track/:trackingId", async (req, res) => {
    try {
        const { trackingId } = req.params;

        if (!trackingId) {
            return res.status(400).json({
                success: false,
                message: "Tracking ID is required",
            });
        }

        const result = await shiprocket.trackShipment(trackingId);

        if (result.success) {
            res.json({
                success: true,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to track shipment",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error tracking shipment:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Generate Label (Public)
app.post("/api/shiprocket/generate-label", async (req, res) => {
    try {
        const { shiprocketOrderIds } = req.body;

        if (!shiprocketOrderIds || !Array.isArray(shiprocketOrderIds) || shiprocketOrderIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Shiprocket order IDs array is required",
            });
        }

        const result = await shiprocket.generateLabel(shiprocketOrderIds);

        if (result.success) {
            res.json({
                success: true,
                message: "Label generated successfully",
                labelUrl: result.labelUrl,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to generate label",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error generating label:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Cancel Shiprocket Order (Public)
app.post("/api/shiprocket/cancel-order", async (req, res) => {
    try {
        const { shiprocketOrderId } = req.body;

        if (!shiprocketOrderId) {
            return res.status(400).json({
                success: false,
                message: "Shiprocket order ID is required",
            });
        }

        const result = await shiprocket.cancelShiprocketOrder(shiprocketOrderId);

        if (result.success) {
            res.json({
                success: true,
                message: "Order cancelled successfully",
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to cancel order",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Get Shipment Details (Public - allows guest order tracking)
app.get("/api/shiprocket/shipment/:shiprocketOrderId", async (req, res) => {
    try {
        const { shiprocketOrderId } = req.params;

        if (!shiprocketOrderId) {
            return res.status(400).json({
                success: false,
                message: "Shiprocket order ID is required",
            });
        }

        // Shiprocket expects a numeric order_id; coerce/validate here
        const numericId = String(shiprocketOrderId).match(/\d+/)?.[0];
        if (!numericId) {
            return res.status(400).json({
                success: false,
                message: "Shiprocket order id must be a number",
            });
        }

        const result = await shiprocket.getShipmentDetails(Number(numericId));

        if (result.success) {
            res.json({
                success: true,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to fetch shipment details",
                error: result.error,
            });
        }
    } catch (error) {
        console.error("Error fetching shipment details:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Retry Shiprocket Order Creation (Admin Only)
app.post("/api/shiprocket/retry-order", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "Order ID is required",
            });
        }

        // Find the order
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Check if order is paid
        if (order.paymentStatus !== "paid") {
            return res.status(400).json({
                success: false,
                message: "Cannot create Shiprocket order for unpaid orders",
            });
        }

        // Get user details
        const user = await User.findById(order.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found for this order",
            });
        }

        console.log(`[SHIPROCKET RETRY] Attempting to retry order ${orderId}`);

        // Helper function for safe values
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

        // Prepare payload matching the working API format
        const uniqueSuffix = Date.now().toString().slice(-4) + Math.floor(Math.random() * 100);
        const shiprocketOrderId = `${order.orderId}-${uniqueSuffix}`;

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
                weight: Number(order.weight) || 0.5,
                length: 10,
                breadth: 10,
                height: 10,
                items: (order.items || []).map(item => ({
                    name: safeValue(item.name, "Product"),
                    sku: safeValue(item.itemId || item.name, "SKU-001"),
                    quantity: Number(item.quantity) || 1,
                    price: Number(item.price) || 0,
                    discount: Number(item.discount) || 0,
                    tax: Number(item.tax) || 0
                }))
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

        // Call the working API endpoint
        try {
            const apiResponse = await axios.post(
                `${SERVER_BASE_URL}/api/shiprocket/create-order`,
                apiPayload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            if (apiResponse.data && apiResponse.data.success) {
                order.shiprocketOrderId = apiResponse.data.shiprocketOrderId || shiprocketOrderId;
                order.shipmentStatus = "created";
                order.shiprocketError = null;
                await order.save();

                console.log(`[SHIPROCKET RETRY] Success for order ${orderId}`);

                res.json({
                    success: true,
                    message: "Shiprocket order created successfully",
                    shiprocketOrderId: apiResponse.data.shiprocketOrderId,
                    data: apiResponse.data,
                });
            } else {
                const errorMsg = apiResponse.data?.error || apiResponse.data?.message || "Unknown error";
                order.shiprocketError = errorMsg;
                order.shipmentStatus = "failed";
                await order.save();

                console.error(`[SHIPROCKET RETRY] Failed for order ${orderId}: ${errorMsg}`);

                res.status(400).json({
                    success: false,
                    message: "Failed to create Shiprocket order",
                    error: errorMsg,
                });
            }
        } catch (apiError) {
            const errorMsg = apiError.response?.data?.error || apiError.response?.data?.message || apiError.message;
            order.shiprocketError = errorMsg;
            order.shipmentStatus = "failed";
            await order.save();

            console.error(`[SHIPROCKET RETRY] API call failed for order ${orderId}: ${errorMsg}`);

            res.status(400).json({
                success: false,
                message: "Failed to create Shiprocket order",
                error: errorMsg,
            });
        }
    } catch (error) {
        console.error("[SHIPROCKET RETRY] Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});

// Get Failed Shiprocket Orders (Admin Only)
app.get("/api/shiprocket/failed-orders", authenticateToken, requireAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Find orders where Shiprocket creation failed
        const query = {
            paymentStatus: "paid",
            $or: [
                { shipmentStatus: "failed" },
                { shipmentStatus: "pending", shiprocketError: { $exists: true, $ne: null, $ne: "" } },
                { awbNumber: { $exists: false } },
                { awbNumber: null },
                { awbNumber: "" }
            ]
        };

        const failedOrders = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('orderId userId address items paymentStatus shipmentStatus shiprocketError awbNumber createdAt totalAmount');

        const totalFailed = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalFailed / limit);

        res.json({
            success: true,
            data: {
                orders: failedOrders,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalOrders: totalFailed,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            }
        });
    } catch (error) {
        console.error("[SHIPROCKET] Error fetching failed orders:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});
};
