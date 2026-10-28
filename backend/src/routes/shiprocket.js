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

// Get Shipping Rates (standard or Quick / hyperlocal)
app.post("/api/shiprocket/shipping-rates", authenticateToken, async (req, res) => {
    try {
        const {
            pickupLocationId,
            deliveryPincode,
            weight,
            orderValue,
            mode,
            lat,
            long,
            cod,
        } = req.body;

        if (!deliveryPincode) {
            return res.status(400).json({
                success: false,
                message: "Delivery pincode is required",
            });
        }

        const shippingMode = mode === "quick" ? "quick" : "standard";
        const pickup =
            pickupLocationId ||
            shiprocket.getPickupPostcode?.() ||
            "110006";

        let dropLat = lat != null ? Number(lat) : NaN;
        let dropLong = long != null ? Number(long) : NaN;

        if (shippingMode === "quick") {
            if (!Number.isFinite(dropLat) || !Number.isFinite(dropLong)) {
                const { getPincodeCoords } = require("../utils/pincodeCoords");
                const fromPin = getPincodeCoords(deliveryPincode);
                if (fromPin) {
                    dropLat = fromPin.lat;
                    dropLong = fromPin.long;
                }
            }
            if (!Number.isFinite(dropLat) || !Number.isFinite(dropLong)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Same day delivery isn't available for this pincode (no drop coordinates)",
                });
            }
            if (!shiprocket.getPickupCoords?.()) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Shop pickup coordinates are not configured (SHIPROCKET_PICKUP_LAT/LONG)",
                });
            }
        }

        const result = await shiprocket.getShippingRate(
            pickup,
            deliveryPincode,
            weight || 1,
            orderValue || 0,
            {
                mode: shippingMode,
                lat: dropLat,
                long: dropLong,
                // Default prepaid (Instamojo); only COD when client explicitly sends 1/true
                cod: cod === 1 || cod === true ? 1 : 0,
            }
        );

        if (result.success) {
            res.json({
                success: true,
                mode: shippingMode,
                data: result.data,
            });
        } else {
            res.status(400).json({
                success: false,
                mode: shippingMode,
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

        // Allow prepaid (paid) or COD confirmed orders
        const canShip =
            order.paymentStatus === "paid" ||
            (order.paymentMethod === "cod" &&
                ["confirmed", "processing", "pending"].includes(order.orderStatus));
        if (!canShip) {
            return res.status(400).json({
                success: false,
                message:
                    "Cannot create Shiprocket order: need paid online order or confirmed COD order",
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

        try {
            const result = await createShipmentForOrder(order, {
                email: user.email,
                forceOrderIdSuffix: true,
            });

            if (result.success) {
                console.log(`[SHIPROCKET RETRY] Success for order ${orderId}`);
                return res.json({
                    success: true,
                    message: "Shiprocket order created successfully",
                    shiprocketOrderId: result.shiprocketOrderId,
                    shippingMode: result.shippingMode,
                    shippingFallbackUsed: !!result.shippingFallbackUsed,
                    awbNumber: result.awbNumber || null,
                });
            }

            console.error(`[SHIPROCKET RETRY] Failed for order ${orderId}: ${result.error}`);
            return res.status(400).json({
                success: false,
                message: result.error || "Shiprocket create failed",
                shippingFallbackUsed: !!result.shippingFallbackUsed,
            });
        } catch (retryErr) {
            const errorMsg = retryErr.message || "Retry failed";
            order.shiprocketError = errorMsg;
            order.shipmentStatus = "failed";
            await order.save();
            return res.status(500).json({
                success: false,
                message: errorMsg,
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
