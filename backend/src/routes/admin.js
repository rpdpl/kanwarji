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


module.exports = function registerAdminRoutes(app) {
app.get(
    "/api/admin/stats",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const totalUsers = await User.countDocuments({
                userType: { $ne: "admin" },
            });
            const totalSellers = await User.countDocuments({ userType: "seller" });
            const pendingRequests = await SellerRequest.countDocuments({
                status: "pending",
            });
            const activeSellers = await User.countDocuments({
                userType: "seller",
                isActive: true,
            });
            const totalProducts = await Item.countDocuments({});
            const availableProducts = await Item.countDocuments({
                isAvailable: true,
            });
            const hiddenProducts = await Item.countDocuments({ isAvailable: false });
            const totalOrders = await Order.countDocuments({});

            const stats = {
                totalUsers,
                totalSellers,
                pendingRequests,
                activeSellers,
                totalProducts,
                availableProducts,
                hiddenProducts,
                totalOrders,
            };
            res.json({
                success: true,
                stats,
            });
        } catch (error) {
            console.error("Get admin stats error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch admin statistics",
            });
        }
    }
);

// Get Seller Requests
app.get(
    "/api/admin/seller-requests",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { status, page = 1, limit = 10 } = req.query;
            const query = {};
            if (status) {
                query.status = status;
            }
            const requests = await SellerRequest.find(query)
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .populate("userId", "name email phone")
                .populate("processedBy", "name email");
            const total = await SellerRequest.countDocuments(query);
            res.json({
                success: true,
                requests,
                totalPages: Math.ceil(total / limit),
                currentPage: Number.parseInt(page),
                totalRequests: total,
            });
        } catch (error) {
            console.error("Get seller requests error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch seller requests",
            });
        }
    }
);

// Approve Seller Request
app.post(
    "/api/admin/seller-requests/:id/approve",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const sellerRequest = await SellerRequest.findById(requestId);
            if (!sellerRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Seller request not found",
                });
            }
            if (sellerRequest.status !== "pending") {
                return res.status(400).json({
                    success: false,
                    message: "This request has already been processed",
                });
            }
            // Update seller request
            sellerRequest.status = "approved";
            sellerRequest.processedAt = new Date();
            sellerRequest.processedBy = adminId;
            await sellerRequest.save();
            // Update user to seller
            const user = await User.findById(sellerRequest.userId);
            if (user) {
                user.userType = "seller";
                user.storeName = sellerRequest.storeName;
                user.storeAddress = sellerRequest.storeAddress;
                user.businessLicense = sellerRequest.businessLicense;
                user.sellerRequestStatus = "approved";
                user.isVerified = true;
                user.updatedAt = new Date();
                await user.save();
            }
            res.json({
                success: true,
                message: "Seller request approved successfully",
                request: sellerRequest,
            });
        } catch (error) {
            console.error("Approve seller request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to approve seller request",
            });
        }
    }
);

// Reject Seller Request
app.post(
    "/api/admin/seller-requests/:id/reject",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const requestId = req.params.id;
            const adminId = req.user.id;
            const { reason } = req.body;
            const sellerRequest = await SellerRequest.findById(requestId);
            if (!sellerRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Seller request not found",
                });
            }
            if (sellerRequest.status !== "pending") {
                return res.status(400).json({
                    success: false,
                    message: "This request has already been processed",
                });
            }
            // Update seller request
            sellerRequest.status = "rejected";
            sellerRequest.processedAt = new Date();
            sellerRequest.processedBy = adminId;
            sellerRequest.rejectionReason = reason;
            await sellerRequest.save();
            // Update user status
            const user = await User.findById(sellerRequest.userId);
            if (user) {
                user.sellerRequestStatus = "rejected";
                user.updatedAt = new Date();
                await user.save();
            }
            res.json({
                success: true,
                message: "Seller request rejected successfully",
                request: sellerRequest,
            });
        } catch (error) {
            console.error("Reject seller request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to reject seller request",
            });
        }
    }
);

// Get All Sellers
app.get(
    "/api/admin/sellers",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { page = 1, limit = 10, search, status } = req.query;
            const query = { userType: "seller" };
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { storeName: { $regex: search, $options: "i" } },
                ];
            }
            if (status) {
                query.isActive = status === "active";
            }
            const sellers = await User.find(query)
                .select("-password")
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);
            const total = await User.countDocuments(query);
            res.json({
                success: true,
                sellers,
                totalPages: Math.ceil(total / limit),
                currentPage: Number.parseInt(page),
                totalSellers: total,
            });
        } catch (error) {
            console.error("Get sellers error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch sellers",
            });
        }
    }
);

// Toggle Seller Status (Activate/Deactivate)
app.patch(
    "/api/admin/sellers/:id/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const sellerId = req.params.id;
            const { isActive } = req.body;
            const seller = await User.findOne({
                _id: sellerId,
                userType: "seller",
            });
            if (!seller) {
                return res.status(404).json({
                    success: false,
                    message: "Seller not found",
                });
            }
            seller.isActive = isActive;
            seller.updatedAt = new Date();
            await seller.save();
            // If deactivating, also deactivate all their items
            if (!isActive) {
                await Item.updateMany(
                    { sellerId: sellerId },
                    { isAvailable: false, updatedAt: new Date() }
                );
            }
            res.json({
                success: true,
                message: `Seller ${isActive ? "activated" : "deactivated"
                    } successfully`,
                seller: {
                    id: seller._id,
                    name: seller.name,
                    email: seller.email,
                    isActive: seller.isActive,
                },
            });
        } catch (error) {
            console.error("Toggle seller status error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update seller status",
            });
        }
    }
);
app.get("/api/admin-items", async (req, res) => {
    try {
        const {
            category,
            search,
            page = 1,
            limit = 20,
            status = "available",
        } = req.query;

        // Query to find only admin-added items
        const query = {
            sellerName: "admin", // Items added by admin have sellerName as "admin"
        };

        // By default, only show available items for public API
        // You can change this behavior by modifying the default status
        if (status === "available") {
            query.isAvailable = true;
        } else if (status === "hidden") {
            query.isAvailable = false;
        } else if (status === "all") {
            // Don't filter by availability - show all admin items
        } else {
            // Default to available items
            query.isAvailable = true;
        }

        // Filter by category
        if (category) {
            query.category = { $regex: category, $options: "i" };
        }

        // Search functionality
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { productDetails: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
            ];
        }

        const items = await Item.find(query)
            .select(
                "name productDetails  price category imageUrl images videoUrl quantity unit variants sellerId sellerName storeName discount tax hasVAT isAvailable createdAt updatedAt isSpecialItem"
            ) // include images, videoUrl
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Item.countDocuments(query);

        res.json({
            success: true,
            items,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            totalItems: total,
            message: "Admin items retrieved successfully",
        });
    } catch (error) {
        console.error("Get admin items error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch admin items",
        });
    }
});

// Admin: Toggle Item Availability
app.patch(
    "/api/admin/items/:id/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const itemId = req.params.id;
            const { isAvailable } = req.body;
            const item = await Item.findById(itemId);
            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: "Item not found",
                });
            }
            item.isAvailable = !!isAvailable;
            item.updatedAt = new Date();
            await item.save();
            res.json({
                success: true,
                message: `Item ${isAvailable ? "activated (visible)" : "deactivated (hidden)"
                    } successfully`,
                item: {
                    id: item._id,
                    name: item.name,
                    isAvailable: item.isAvailable,
                },
            });
        } catch (error) {
            console.error("Admin toggle item status error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update item status",
            });
        }
    }
);

// Get All Users (for admin)
app.get(
    "/api/admin/users",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { page = 1, limit = 10, search, userType } = req.query;
            const query = { userType: { $ne: "admin" } };
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                ];
            }
            if (userType && userType !== "all") {
                query.userType = userType;
            }
            const users = await User.find(query)
                .select("-password")
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);
            const total = await User.countDocuments(query);
            res.json({
                success: true,
                users,
                totalPages: Math.ceil(total / limit),
                currentPage: Number.parseInt(page),
                totalUsers: total,
            });
        } catch (error) {
            console.error("Get users error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch users",
            });
        }
    }
);

// Create Admin User (Run this once to create your first admin)
app.post("/api/create-admin", async (req, res) => {
    try {
        const { name, email, phone, password, secretKey } = req.body;
        // Use a secret key to protect this endpoint
        if (secretKey !== "create-admin-secret-2024") {
            return res.status(401).json({
                success: false,
                message: "Invalid secret key",
            });
        }
        // Check if admin already exists
        const existingAdmin = await User.findOne({ userType: "admin" });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: "Admin user already exists",
            });
        }
        // Check if user with email/phone already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }],
        });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email or phone number.",
            });
        }
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create admin user
        const admin = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            userType: "admin",
            isVerified: true,
        });
        await admin.save();
        res.status(201).json({
            success: true,
            message: "Admin user created successfully!",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                userType: admin.userType,
            },
        });
    } catch (error) {
        console.error("Create admin error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create admin user",
        });
    }
});

// Toggle User Status (Activate/Deactivate) - For admin
app.patch(
    "/api/admin/users/:id/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const userId = req.params.id;
            const { isActive } = req.body;
            // Prevent admin from changing their own status or other admins
            const user = await User.findOne({
                _id: userId,
                userType: { $ne: "admin" },
            });
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found or you cannot modify admin status",
                });
            }
            user.isActive = isActive;
            user.updatedAt = new Date();
            await user.save();
            // If user is a seller, also update their items' isAvailable status
            if (user.userType === "seller") {
                await Item.updateMany(
                    { sellerId: userId },
                    { isAvailable: !!isActive, updatedAt: new Date() }
                );
            }
            res.json({
                success: true,
                message: `User ${isActive ? "activated" : "deactivated"} successfully`,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    isActive: user.isActive,
                    userType: user.userType,
                },
            });
        } catch (error) {
            console.error("Toggle user status error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update user status",
            });
        }
    }
);

// =============================================================================
// ITEM/PRODUCT MANAGEMENT APIs
// =============================================================================


app.post(
    "/api/admin/orders/:orderId/create-delhivery-shipment",
    authenticateToken,
    requireAdmin,
    async (_req, res) => {
        res.status(410).json({
            success: false,
            message: "Delhivery integration has been removed. Use Shiprocket shipment APIs instead.",
        });
    }
);

// Admin: Get orders with failed shipments or refunds
app.get(
    "/api/admin/orders/failed-shipments",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const failedOrders = await Order.find({
                $or: [
                    { shiprocketError: { $exists: true, $ne: "" } },
                    { delhiveryError: { $exists: true, $ne: "" } }, // legacy field
                    { shipmentStatus: "failed" }
                ]
            })
                .sort({ createdAt: -1 })
                .limit(100);

            const refundPendingOrders = await Order.find({
                paymentMethod: "online",
                paymentStatus: "refunded",
                cancellationInitiatedBy: { $exists: true }
            })
                .sort({ cancelledAt: -1 })
                .limit(100);

            res.json({
                success: true,
                data: {
                    failedShipments: failedOrders,
                    refundsPending: refundPendingOrders,
                    totalFailed: failedOrders.length,
                    totalRefunds: refundPendingOrders.length
                }
            });
        } catch (error) {
            console.error("Get failed orders error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch failed orders"
            });
        }
    }
);

// Admin: Retry refund for a specific cancelled order
app.post(
    "/api/admin/orders/:orderId/retry-refund",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { orderId } = req.params;

            const order = await Order.findOne({
                $or: [{ orderId }, { _id: orderId }]
            });

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found"
                });
            }

            if (order.paymentMethod !== "online") {
                return res.status(400).json({
                    success: false,
                    message: "Only online payment orders can have refunds"
                });
            }

            if (order.orderStatus !== "cancelled") {
                return res.status(400).json({
                    success: false,
                    message: "Only cancelled orders can be refunded"
                });
            }

            console.log(`[ADMIN RETRY] Processing refund for order ${order.orderId}`);
            const refundResult = await processInstamojoRefund(order);

            if (refundResult.success || refundResult.skipped) {
                res.json({
                    success: true,
                    message: "Refund processed successfully",
                    refundResult
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: "Refund processing failed",
                    error: refundResult.error
                });
            }
        } catch (error) {
            console.error("Retry refund error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to process refund",
                error: error.message
            });
        }
    }
);

// Delhivery removed — use /api/shiprocket/retry-order instead
app.post(
    "/api/admin/orders/:orderId/retry-shipment",
    authenticateToken,
    requireAdmin,
    async (_req, res) => {
        res.status(410).json({
            success: false,
            message: "Delhivery integration has been removed. Use POST /api/shiprocket/retry-order instead.",
        });
    }
);

















app.get(
    "/api/admin/cancellation-requests",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { status = "pending", page = 1, limit = 50, search } = req.query;

            const query = {};

            // Filter by status
            if (status && status !== "all") {
                query.status = status;
            }

            // Search functionality
            if (search) {
                query.$or = [
                    { orderIdStr: { $regex: search, $options: "i" } },
                    { customerName: { $regex: search, $options: "i" } },
                    { customerEmail: { $regex: search, $options: "i" } },
                    { customerPhone: { $regex: search, $options: "i" } },
                ];
            }

            const requests = await CancellationRequest.find(query)
                .populate("userId", "name email")
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
            console.error("Get cancellation requests error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch cancellation requests",
            });
        }
    }
);

// Get single cancellation request details
app.get(
    "/api/admin/cancellation-requests/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const request = await CancellationRequest.findById(req.params.id)
                .populate("userId", "name email phone")
                .populate("processedBy", "name email");

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
            console.error("Get cancellation request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch cancellation request",
            });
        }
    }
);

// Approve cancellation request
app.patch(
    "/api/admin/cancellation-requests/:id/approve",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { adminRemarks } = req.body;
            const requestId = req.params.id;

            const cancellationRequest = await CancellationRequest.findById(requestId);

            if (!cancellationRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Cancellation request not found",
                });
            }

            if (cancellationRequest.status !== "pending") {
                return res.status(400).json({
                    success: false,
                    message: "Only pending cancellation requests can be approved",
                });
            }

            // Update cancellation request
            cancellationRequest.status = "approved";
            cancellationRequest.adminRemarks = adminRemarks || "";
            cancellationRequest.processedBy = req.user.id;
            cancellationRequest.processedAt = new Date();
            await cancellationRequest.save();

            // Update order status
            const order = await Order.findById(cancellationRequest.orderId);
            if (order) {
                order.orderStatus = "cancelled";
                order.cancelledAt = new Date();
                order.cancellationReason = cancellationRequest.cancellationReason;
                order.updatedAt = new Date();

                // If payment was made online and already paid, mark for refund
                if (order.paymentMethod === "online" && order.paymentStatus === "paid") {
                    order.paymentStatus = "refunded";
                }

                await order.save();

                // ✅ Cancel order in Shiprocket if applicable
                if ((order.shiprocketOrderId || order.awbNumber) && !order.isLocalShiprocket) {
                    try {
                        const srId = order.shiprocketOrderId || order.awbNumber;
                        console.log(`[SHIPROCKET] Cancelling shipment for approved request: ${srId}`);
                        const srResult = await shiprocket.cancelShiprocketOrder(srId);
                        if (srResult.success) {
                            console.log(`✅ [SHIPROCKET] Order ${srId} cancelled successfully`);
                        } else {
                            console.error(`❌ [SHIPROCKET] Cancellation failed: ${srResult.error}`);
                        }
                    } catch (srError) {
                        console.error(`[SHIPROCKET] Cancellation error:`, srError.message);
                    }
                }

                // Send approval email
                try {
                    const user = await User.findById(cancellationRequest.userId);
                    if (user) {
                        const mailOptions = {
                            from: process.env.EMAIL_USER,
                            to: user.email,
                            subject: `Order Cancellation Approved - ${cancellationRequest.orderIdStr}`,
                            html: `
                                <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                                    <div style="background-color: #fff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                                        <h2 style="color: #333; text-align: center;">Order Cancellation Approved</h2>
                                        <p style="color: #666; font-size: 14px;">Hi ${user.name},</p>
                                        <p style="color: #666; font-size: 14px;">Your cancellation request for order <strong>#${cancellationRequest.orderIdStr}</strong> has been <strong style="color: green;">APPROVED</strong>.</p>
                                        
                                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Order Details:</strong></p>
                                            <p style="margin: 8px 0; color: #666; font-size: 14px;">Order ID: ${cancellationRequest.orderIdStr}</p>
                                            <p style="margin: 8px 0; color: #666; font-size: 14px;">Order Total: ₹${cancellationRequest.totalAmount.toFixed(2)}</p>
                                            <p style="margin: 8px 0; color: #666; font-size: 14px;">Cancellation Reason: ${cancellationRequest.cancellationReason}</p>
                                            ${adminRemarks ? `<p style="margin: 8px 0; color: #666; font-size: 14px;">Admin Notes: ${adminRemarks}</p>` : ""}
                                        </div>

                                        ${order.paymentMethod === "online" && order.paymentStatus === "refunded" ? `
                                            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid green;">
                                                <p style="margin: 0; color: #2e7d32; font-size: 14px;"><strong>Refund Information:</strong></p>
                                                <p style="margin: 8px 0; color: #2e7d32; font-size: 14px;">Your refund of ₹${cancellationRequest.totalAmount.toFixed(2)} has been initiated.</p>
                                                <p style="margin: 8px 0; color: #2e7d32; font-size: 14px;">It will be processed to your original payment method within 3-5 business days.</p>
                                            </div>
                                        ` : ""}

                                        <p style="color: #666; font-size: 14px; margin-top: 20px;">Thank you for your business. If you have any questions, please contact us.</p>
                                        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">This is an automated email. Please do not reply directly.</p>
                                    </div>
                                </div>
                            `,
                        };
                        await sendMail(mailOptions);
                    }
                } catch (emailError) {
                    console.error("Failed to send approval email:", emailError);
                }
            }

            res.json({
                success: true,
                message: "Cancellation request approved successfully",
                data: cancellationRequest,
            });
        } catch (error) {
            console.error("Approve cancellation request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to approve cancellation request",
            });
        }
    }
);

// Reject cancellation request
app.patch(
    "/api/admin/cancellation-requests/:id/reject",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { adminRemarks, adminResponse } = req.body;
            const requestId = req.params.id;

            const cancellationRequest = await CancellationRequest.findById(requestId);

            if (!cancellationRequest) {
                return res.status(404).json({
                    success: false,
                    message: "Cancellation request not found",
                });
            }

            if (cancellationRequest.status !== "pending") {
                return res.status(400).json({
                    success: false,
                    message: "Only pending cancellation requests can be rejected",
                });
            }

            // Update cancellation request
            cancellationRequest.status = "rejected";
            cancellationRequest.adminRemarks = adminRemarks || "";
            cancellationRequest.adminResponse = adminResponse || "Your cancellation request has been rejected";
            cancellationRequest.processedBy = req.user.id;
            cancellationRequest.processedAt = new Date();
            await cancellationRequest.save();

            // Restore order status back to confirmed since cancellation was rejected
            const order = await Order.findById(cancellationRequest.orderId);
            if (order) {
                order.orderStatus = "confirmed";
                order.updatedAt = new Date();
                await order.save();
            }

            // Send rejection email
            try {
                const user = await User.findById(cancellationRequest.userId);
                if (user) {
                    const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: user.email,
                        subject: `Order Cancellation Request - ${cancellationRequest.orderIdStr}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                                <div style="background-color: #fff; padding: 30px; border-radius: 8px; max-width: 600px; margin: 0 auto;">
                                    <h2 style="color: #333; text-align: center;">Cancellation Request Status</h2>
                                    <p style="color: #666; font-size: 14px;">Hi ${user.name},</p>
                                    <p style="color: #666; font-size: 14px;">Your cancellation request for order <strong>#${cancellationRequest.orderIdStr}</strong> has been <strong style="color: #d32f2f;">DECLINED</strong>.</p>
                                    
                                    <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #d32f2f;">
                                        <p style="margin: 0; color: #c62828; font-size: 14px;"><strong>Reason:</strong></p>
                                        <p style="margin: 8px 0; color: #c62828; font-size: 14px;">${adminResponse || "Your cancellation request cannot be processed at this time."}</p>
                                        ${adminRemarks ? `<p style="margin: 8px 0; color: #c62828; font-size: 14px;"><strong>Admin Notes:</strong> ${adminRemarks}</p>` : ""}
                                    </div>

                                    <p style="color: #666; font-size: 14px; margin-top: 20px;">Your order <strong>#${cancellationRequest.orderIdStr}</strong> remains active. If you have any questions, please contact our support team.</p>
                                    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">This is an automated email. Please do not reply directly.</p>
                                </div>
                            </div>
                        `,
                    };
                    await sendMail(mailOptions);
                }
            } catch (emailError) {
                console.error("Failed to send rejection email:", emailError);
            }

            res.json({
                success: true,
                message: "Cancellation request rejected successfully",
                data: cancellationRequest,
            });
        } catch (error) {
            console.error("Reject cancellation request error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to reject cancellation request",
            });
        }
    }
);

// =============================================================================
// FACEBOOK OAUTH (optional)

app.get(
    "/api/admin/orders",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { page = 1, limit = 50, status, search } = req.query;

            const query = {};

            // Filter by status if provided
            if (status && status !== "all") {
                query.orderStatus = status;
            }

            // Search functionality
            if (search) {
                query.$or = [
                    { orderId: { $regex: search, $options: "i" } },
                    { "userId.name": { $regex: search, $options: "i" } },
                    { "userId.email": { $regex: search, $options: "i" } },
                ];
            }

            const orders = await Order.find(query)
                .populate("userId", "name email phone")
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Order.countDocuments(query);

            res.json({
                success: true,
                data: {
                    orders,
                    totalPages: Math.ceil(total / limit),
                    currentPage: Number.parseInt(page),
                    totalOrders: total,
                },
            });
        } catch (error) {
            console.error("Get admin orders error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch orders",
            });
        }
    }
);
// Admin: Update payment status and send confirmation email on transition to paid
app.patch(
    "/api/admin/orders/:id/payment",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { paymentStatus } = req.body || {};

            if (!paymentStatus || !["pending", "paid", "failed", "refunded"].includes(paymentStatus)) {
                return res.status(400).json({ success: false, message: "Invalid paymentStatus" });
            }

            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            const prevPaymentStatus = order.paymentStatus;
            order.paymentStatus = paymentStatus;
            if (paymentStatus === "paid" && order.orderStatus === "pending") {
                order.orderStatus = "confirmed";
            }
            order.updatedAt = new Date();
            await order.save();

            // Send confirmation email only on transition to paid
            if (prevPaymentStatus !== "paid" && order.paymentStatus === "paid") {
                try {
                    const user = await User.findById(order.userId);
                    if (user) await sendOrderConfirmationEmail(user, order);
                } catch (e) {
                    console.error("Admin payment-status email failed:", e?.message || e);
                }
            }

            return res.json({ success: true, order });
        } catch (error) {
            console.error("Admin update payment status error:", error);
            return res.status(500).json({ success: false, message: "Failed to update payment status" });
        }
    }
);

// Admin: Cancel Order
app.patch(
    "/api/admin/orders/:id/cancel",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason, remarks } = req.body || {};

            const order = await Order.findById(id);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            // Check if order can be cancelled
            if (order.orderStatus === "cancelled") {
                return res.status(400).json({
                    success: false,
                    message: "This order is already cancelled"
                });
            }

            if (order.orderStatus === "delivered") {
                return res.status(400).json({
                    success: false,
                    message: "Cannot cancel delivered orders"
                });
            }

            // Update order for admin cancellation
            order.orderStatus = "cancelled";
            order.cancelledAt = new Date();
            order.cancellationReason = reason || "Cancelled by admin";
            order.cancellationInitiatedBy = "admin";
            order.adminRemarks = remarks || "";
            order.updatedAt = new Date();

            // If payment was made online, process refund via Instamojo
            let refundResult = null;
            if (order.paymentMethod === "online" && order.paymentStatus === "paid") {
                order.paymentStatus = "refunded";
                console.log(`Processing refund for order ${order.orderId}`);
                refundResult = await processInstamojoRefund(order);

                if (!refundResult.success && !refundResult.skipped) {
                    console.error(`Refund processing failed: ${refundResult.error}`);
                }
                order.refundedAt = new Date();
            }

            await order.save();

            // ✅ Cancel order in Shiprocket if applicable
            if ((order.shiprocketOrderId || order.awbNumber) && !order.isLocalShiprocket) {
                try {
                    const srId = order.shiprocketOrderId || order.awbNumber;
                    console.log(`[SHIPROCKET] Admin cancelling shipment for order ${order.orderId}, ID: ${srId}`);
                    const srResult = await shiprocket.cancelShiprocketOrder(srId);
                    if (srResult.success) {
                        console.log(`✅ [SHIPROCKET] Order ${srId} cancelled successfully`);
                    } else {
                        console.error(`❌ [SHIPROCKET] Cancellation failed: ${srResult.error}`);
                    }
                } catch (srError) {
                    console.error(`[SHIPROCKET] Cancellation error:`, srError.message);
                }
            }

            // Send cancellation email to user
            try {
                const user = await User.findById(order.userId);
                if (user) {
                    await sendOrderCancellationEmail(user, order, reason);
                }
            } catch (emailError) {
                console.error("Failed to send admin cancellation email:", emailError);
                // Don't fail the operation if email fails
            }

            return res.json({
                success: true,
                message: "Order cancelled successfully by admin",
                order: {
                    orderId: order.orderId,
                    orderStatus: order.orderStatus,
                    cancelledAt: order.cancelledAt,
                    cancellationReason: order.cancellationReason,
                    adminRemarks: order.adminRemarks
                }
            });
        } catch (error) {
            console.error("Admin cancel order error:", error);
            return res.status(500).json({ success: false, message: "Failed to cancel order" });
        }
    }
);

// Get all users for admin
app.get(
    "/api/admin/users",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { page = 1, limit = 100, userType, search } = req.query;

            const query = {};

            // Filter by user type if provided
            if (userType && userType !== "all") {
                query.userType = userType;
            }

            // Search functionality
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                ];
            }

            const users = await User.find(query)
                .select("-password") // Exclude password field
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await User.countDocuments(query);

            res.json({
                success: true,
                users,
                totalPages: Math.ceil(total / limit),
                currentPage: Number.parseInt(page),
                totalUsers: total,
            });
        } catch (error) {
            console.error("Get admin users error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch users",
            });
        }
    }
);

app.post("/api/items", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        // Allow both sellers and admins to add items
        if (!user || (user.userType !== "seller" && user.userType !== "admin")) {
            return res.status(403).json({
                success: false,
                message: "Only approved sellers and admins can add items",
            });
        }

        // For sellers, check if they are active
        if (user.userType === "seller" && !user.isActive) {
            return res.status(403).json({
                success: false,
                message:
                    "Your seller account is currently deactivated. Please contact admin.",
            });
        }

        const { name, productDetails, price, category, imageUrl, quantity, unit } =
            req.body;

        const item = new Item({
            name,
            productDetails,
            price,
            category,
            imageUrl,
            quantity,
            unit,
            sellerId: user._id,
            sellerName: user.name,
            storeName: user.storeName || user.name,
        });

        await item.save();

        res.status(201).json({
            success: true,
            message: "Item added successfully!",
            item,
        });
    } catch (error) {
        console.error("Add item error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add item. Please try again.",
        });
    }
});

app.patch(
    "/api/admin/items/:itemId/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { itemId } = req.params;
            const { isAvailable } = req.body;

            const item = await Item.findByIdAndUpdate(
                itemId,
                { isAvailable },
                { new: true }
            );

            if (!item) {
                return res.status(404).json({
                    success: false,
                    message: "Item not found",
                });
            }

            res.json({
                success: true,
                message: `Item ${isAvailable ? "made available" : "hidden"
                    } successfully`,
                item,
            });
        } catch (error) {
            console.error("Toggle item status error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update item status",
            });
        }
    }
);

app.get(
    "/api/admin/orders/:orderId/invoice/download",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { orderId } = req.params;

            const order = await Order.findOne({ orderId }).populate(
                "userId",
                "name email phone"
            );

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            // Generate PDF
            const pdfBuffer = await generateInvoicePDF(order);

            // Set headers for PDF download
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="invoice_${orderId}.pdf"`
            );
            res.setHeader("Content-Length", pdfBuffer.length);

            // Send PDF buffer
            res.send(pdfBuffer);
        } catch (error) {
            console.error("Download invoice error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to generate invoice",
            });
        }
    }
);

// Get Invoice Data (for mobile app PDF generation)
app.get(
    "/api/admin/orders/:orderId/invoice/data",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { orderId } = req.params;

            const order = await Order.findOne({ orderId }).populate(
                "userId",
                "name email phone"
            );

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: "Order not found",
                });
            }

            // Return structured invoice data
            const invoiceData = {
                // Company Details
                company: {
                    name: "Your Company Name",
                    address: "123 Business Street",
                    city: "Business City, State 12345",
                    phone: "+1 (555) 123-4567",
                    email: "info@yourcompany.com",
                    website: "www.yourcompany.com",
                },

                // Invoice Details
                invoice: {
                    number: orderId,
                    date: order.createdAt,
                    dueDate: order.estimatedShiprocket,
                },

                // Customer Details
                customer: {
                    name: order.userId.name,
                    email: order.userId.email,
                    phone: order.userId.phone,
                    address: {
                        name: order.address.name,
                        phone: order.address.phone,
                        address: order.address.address,
                        city: order.address.city,
                        state: order.address.state,
                        pincode: order.address.pincode,
                    },
                },

                // Order Details
                order: {
                    id: order._id,
                    orderId: order.orderId,
                    // Ensure each item has variantLabel/unit keys if they already exist on the document
                    items: (order.items || []).map((it) => ({
                        ...(it?.toObject ? it.toObject() : it),
                        variantLabel: it?.variantLabel || it?.unit || "",  // will drive UI display
                        unit: it?.unit || it?.variantLabel || "",
                    })),
                    subtotal: order.subtotal,
                    shiprocketFee: order.shiprocketFee,
                    taxAmount: order.taxAmount,
                    convenienceFee: Number(order.convenienceFee || 0),    // allow the UI to show and add it
                    totalAmount: order.totalAmount,
                    paymentMethod: order.paymentMethod,
                    paymentStatus: order.paymentStatus,
                    orderStatus: order.orderStatus,
                    createdAt: order.createdAt,
                    estimatedShiprocket: order.estimatedShiprocket,
                },
            };

            res.json({
                success: true,
                invoiceData,
            });
        } catch (error) {
            console.error("Get invoice data error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch invoice data",
            });
        }
    }
);
app.get(
    "/api/admin/users/:userId",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { userId } = req.params;

            const user = await User.findById(userId).select("-password");
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            // Get user's order statistics
            const totalOrders = await Order.countDocuments({ userId });
            const completedOrders = await Order.countDocuments({
                userId,
                orderStatus: "delivered",
            });

            const totalSpentResult = await Order.aggregate([
                { $match: { userId: mongoose.Types.ObjectId(userId) } },
                { $group: { _id: null, total: { $sum: "$totalAmount" } } },
            ]);

            const totalSpent =
                totalSpentResult.length > 0 ? totalSpentResult[0].total : 0;

            const userDetails = {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                userType: user.userType,
                isActive: user.isActive,
                isVerified: user.isVerified,
                createdAt: user.createdAt,
                totalOrders,
                completedOrders,
                totalSpent,
            };

            res.json({
                success: true,
                user: userDetails,
            });
        } catch (error) {
            console.error("Get user details error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch user details",
            });
        }
    }
);

// Get User Order History (for View Customer feature)
app.get(
    "/api/admin/users/:userId/orders",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const orders = await Order.find({ userId })
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const totalOrders = await Order.countDocuments({ userId });

            res.json({
                success: true,
                orders,
                totalPages: Math.ceil(totalOrders / limit),
                currentPage: parseInt(page),
                totalOrders,
            });
        } catch (error) {
            console.error("Get user orders error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch user orders",
            });
        }
    }
);

// Updated API endpoint to handle both JSON and multipart data
app.post(
    "/api/admin/items",
    authenticateToken,
    requireAdmin,
    (req, res, next) => {
        // Check content type to decide how to handle the request
        const contentType = req.get("Content-Type");

        if (contentType && contentType.includes("multipart/form-data")) {
            // Handle file upload
            // Accept up to 4 images as 'images', optional single 'video', and legacy single 'media'
            upload.fields([
                { name: "images", maxCount: 4 },
                { name: "video", maxCount: 1 },
                { name: "media", maxCount: 1 }, // backward compatibility
            ])(req, res, (err) => {
                if (err) {
                    console.error("Multer error on /api/admin/items:", err);
                    const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
                    return res.status(statusCode).json({
                        success: false,
                        message: err.message || "File upload error",
                    });
                }
                next();
            });
        } else {
            // Handle JSON data (no file upload)
            next();
        }
    },
    async (req, res) => {
        try {
            console.log("Request body:", req.body);
            console.log("Uploaded files:", req.files);
            console.log("Content-Type:", req.get("Content-Type"));

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const {
                name,
                productDetails,
                price,
                category,
                quantity,
                unit,
                imageUrl, // from JSON requests
                imageUrls, // array from JSON requests
                videoUrl, // from JSON requests
                discount = 0,
                tax = 0,
                hasVAT = false,
                isSpecialItem = false,
            } = req.body;

            // Parse variants (can arrive as JSON or as a string in multipart)
            let variants = req.body.variants;
            if (typeof variants === "string" && variants.trim()) {
                try {
                    variants = JSON.parse(variants);
                } catch (e) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid variants format",
                    });
                }
            }
            const hasValidVariants = Array.isArray(variants) && variants.length > 0 &&
                variants.every(v => v && v.label != null && v.price != null && v.quantity != null);
            let parsedVariants = hasValidVariants
                ? variants.map(v => ({
                    label: String(v.label).trim(),
                    price: Number(v.price),
                    quantity: Number(v.quantity),
                }))
                : [];

            // Validate basic required fields
            if (!name || !productDetails || !category) {
                return res.status(400).json({
                    success: false,
                    message: "Product name, category and description are required",
                });
            }
            if (!parsedVariants.length) {
                return res.status(400).json({
                    success: false,
                    message: "Variants are required",
                });
            }

            // Collect media URLs (support up to 4 images + optional 1 video)
            const finalImages = [];
            let finalVideoUrl = "";

            // 1) From multipart uploads -> upload to Cloudinary
            if (
                req.files &&
                (req.files.images || req.files.video || req.files.media)
            ) {
                // Ensure Cloudinary is configured
                if (
                    !cloudinary.config().cloud_name ||
                    !cloudinary.config().api_key ||
                    !cloudinary.config().api_secret
                ) {
                    return res.status(500).json({
                        success: false,
                        message: "Media upload service is not configured",
                    });
                }
                const imageFiles = req.files.images || [];
                const legacyMedia = req.files.media || [];
                // If legacy media is an image, treat it as image; if video, as video
                legacyMedia.forEach((f) => {
                    if (f.mimetype && f.mimetype.startsWith("image/")) imageFiles.push(f);
                });
                const videoFiles =
                    req.files.video ||
                    legacyMedia.filter(
                        (f) => f.mimetype && f.mimetype.startsWith("video/")
                    );

                if (imageFiles.length > 4) {
                    return res
                        .status(400)
                        .json({ success: false, message: "Maximum 4 images allowed" });
                }

                // Upload images sequentially to avoid rate limits
                for (const file of imageFiles) {
                    const uploadRes = await cloudinary.uploader.upload(file.path, {
                        folder: "products",
                        resource_type: "image",
                    });
                    finalImages.push(uploadRes.secure_url);
                    try {
                        fs.unlinkSync(file.path);
                    } catch (e) { }
                }

                if (videoFiles && videoFiles[0]) {
                    const vfile = videoFiles[0];
                    const vRes = await cloudinary.uploader.upload(vfile.path, {
                        folder: "products",
                        resource_type: "video",
                    });
                    finalVideoUrl = vRes.secure_url;
                    try {
                        fs.unlinkSync(vfile.path);
                    } catch (e) { }
                }
            }

            // 2) From JSON body
            if (!finalImages.length) {
                if (Array.isArray(imageUrls)) {
                    if (imageUrls.length > 4) {
                        return res
                            .status(400)
                            .json({ success: false, message: "Maximum 4 images allowed" });
                    }
                    finalImages.push(...imageUrls.filter(Boolean));
                } else if (imageUrl) {
                    finalImages.push(imageUrl);
                }
            }
            if (!finalVideoUrl && videoUrl) {
                finalVideoUrl = videoUrl;
            }

            console.log("Final media to save:", {
                images: finalImages,
                videoUrl: finalVideoUrl,
            });

            // Require at least one media (image or video)
            if (!finalImages.length && !finalVideoUrl) {
                return res.status(400).json({
                    success: false,
                    message: "Product media is required",
                });
            }

            // Prepare variants already parsed above and derive top-level price/quantity for compatibility
            // Derive top-level price as first variant price (if exists) or provided price
            const derivedPrice = parsedVariants.length ? parsedVariants[0].price : (price ? parseFloat(price) : undefined);
            // Derive total quantity as sum of variant quantities or provided quantity
            const derivedQuantity = parsedVariants.length ? parsedVariants.reduce((s, vv) => s + Number(vv.quantity), 0) : (quantity ? parseInt(quantity) : undefined);

            const item = new Item({
                name: name.trim(),
                productDetails: productDetails.trim(),
                price: derivedPrice,
                category: category.trim(),
                imageUrl: finalImages[0] || "",
                images: finalImages,
                videoUrl: finalVideoUrl || "",
                quantity: derivedQuantity,
                unit: unit ? String(unit).trim() : undefined,
                variants: parsedVariants,
                sellerId: user._id,
                sellerName: user.name,
                storeName: user.storeName || user.name,
                discount: parseFloat(discount),
                tax: parseFloat(tax),
                hasVAT: hasVAT === "true" || hasVAT === true,
                isAvailable: true,
                isSpecialItem: isSpecialItem === "true" || isSpecialItem === true,
            });

            const savedItem = await item.save();
            console.log("Item saved with imageUrl:", savedItem.imageUrl);

            res.status(201).json({
                success: true,
                message: "Product added successfully by admin!",
                item: savedItem,
            });
        } catch (error) {
            console.error("Admin add item error:", error);
            console.error("Error stack:", error.stack);

            // More specific error handling
            if (error.name === "ValidationError") {
                const validationErrors = Object.values(error.errors)
                    .map((e) => e.message)
                    .join(", ");
                return res.status(400).json({
                    success: false,
                    message: `Validation error: ${validationErrors}`,
                });
            }

            if (error.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: "Product with this name already exists",
                });
            }

            res.status(500).json({
                success: false,
                message: "Failed to add product. Please try again.",
                error:
                    process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
    }
);

// Alternative approach: Create separate endpoints for different upload methods
// This might be cleaner if you want to handle them differently

// Endpoint for JSON requests (predefined images, custom URLs)
app.post(
    "/api/admin/items/json",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            console.log("JSON Request body:", req.body);

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const {
                name,
                productDetails,
                price,
                category,
                quantity,
                unit,
                imageUrl,
                imageUrls,
                videoUrl,
                discount = 0,
                tax = 0,
                hasVAT = false,
            } = req.body;

            // Parse variants if provided (may be JSON string)
            let variants = req.body.variants;
            if (typeof variants === "string" && variants.trim()) {
                try {
                    variants = JSON.parse(variants);
                } catch (e) {
                    // leave as string; will fail validation below
                }
            }

            const hasValidVariants = Array.isArray(variants) && variants.length > 0 && variants.every(v => v && v.label && !isNaN(Number(v.price)) && !isNaN(Number(v.quantity)));

            // Validate required fields (strict): name, details, category, variants, and media
            if (!name || !productDetails || !category) {
                return res.status(400).json({ success: false, message: "Product name, category and description are required" });
            }

            console.log("Media URLs from request:", {
                imageUrl,
                imageUrls,
                videoUrl,
            });
            const imagesArr = Array.isArray(imageUrls)
                ? imageUrls.filter(Boolean)
                : imageUrl
                    ? [imageUrl]
                    : [];
            if (imagesArr.length > 4) {
                return res
                    .status(400)
                    .json({ success: false, message: "Maximum 4 images allowed" });
            }

            if (!hasValidVariants) {
                return res.status(400).json({ success: false, message: "Variants are required" });
            }
            if (!imagesArr.length && !videoUrl) {
                return res.status(400).json({ success: false, message: "Product media is required" });
            }

            // Prepare parsed variants and derive compatibility fields
            let parsedVariants = hasValidVariants ? variants.map(v => ({ label: String(v.label).trim(), price: Number(v.price), quantity: Number(v.quantity) })) : [];
            const derivedPrice = parsedVariants.length ? parsedVariants[0].price : (price ? parseFloat(price) : undefined);
            const derivedQuantity = parsedVariants.length ? parsedVariants.reduce((s, vv) => s + Number(vv.quantity), 0) : (quantity ? parseInt(quantity) : undefined);

            // Create item
            const item = new Item({
                name: name.trim(),
                productDetails: productDetails.trim(),
                price: derivedPrice,
                category: category.trim(),
                imageUrl: imagesArr[0] || "",
                images: imagesArr,
                videoUrl: videoUrl || "",
                quantity: derivedQuantity,
                unit: unit ? String(unit).trim() : undefined,
                variants: parsedVariants,
                sellerId: user._id,
                sellerName: user.name,
                storeName: user.storeName || user.name,
                discount: parseFloat(discount),
                tax: parseFloat(tax),
                hasVAT: hasVAT === "true" || hasVAT === true,
                isAvailable: true,
            });

            const savedItem = await item.save();
            console.log("Item saved with imageUrl:", savedItem.imageUrl);

            res.status(201).json({
                success: true,
                message: "Product added successfully by admin!",
                item: savedItem,
            });
        } catch (error) {
            console.error("Admin add item error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to add product. Please try again.",
                error:
                    process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
    }
);

// Endpoint for file uploads
app.post(
    "/api/admin/items/upload",
    authenticateToken,
    requireAdmin,
    upload.single("media"),
    async (req, res) => {
        try {
            console.log("Upload Request body:", req.body);
            console.log("Uploaded file:", req.file);

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const {
                name,
                productDetails,
                price,
                category,
                quantity,
                unit,
                discount = 0,
                tax = 0,
                hasVAT = false,
                isSpecialItem = false,
            } = req.body;

            // Parse variants if provided (may be JSON string)
            let variants = req.body.variants;
            if (typeof variants === "string" && variants.trim()) {
                try {
                    variants = JSON.parse(variants);
                } catch (e) {
                    // leave as string; will fail validation below
                }
            }

            const hasValidVariants = Array.isArray(variants) && variants.length > 0 && variants.every(v => v && v.label && !isNaN(Number(v.price)) && !isNaN(Number(v.quantity)));

            // Validate required fields (strict): name, details, category, variants, and media
            if (!name || !productDetails || !category) {
                return res.status(400).json({ success: false, message: "Product name, category and description are required" });
            }
            if (!hasValidVariants) {
                return res.status(400).json({ success: false, message: "Variants are required" });
            }

            // Generate media URL from uploaded file (require at least one file)
            let imageUrl = "";
            let videoUrl = "";
            if (req.file) {
                const fileUrl = `${req.protocol}://${req.get("host")}/uploads/products/${req.file.filename}`;
                if (req.file.mimetype.startsWith("image/")) {
                    imageUrl = fileUrl;
                } else if (req.file.mimetype.startsWith("video/")) {
                    videoUrl = fileUrl;
                }
            }
            if (!imageUrl && !videoUrl) {
                return res.status(400).json({ success: false, message: "Product media is required" });
            }

            console.log("Generated media URL from upload:", { imageUrl, videoUrl });

            // Prepare parsed variants and derive compatibility fields
            let parsedVariants = hasValidVariants ? variants.map(v => ({ label: String(v.label).trim(), price: Number(v.price), quantity: Number(v.quantity) })) : [];
            const derivedPrice = parsedVariants.length ? parsedVariants[0].price : (price ? parseFloat(price) : undefined);
            const derivedQuantity = parsedVariants.length ? parsedVariants.reduce((s, vv) => s + Number(vv.quantity), 0) : (quantity ? parseInt(quantity) : undefined);

            // Create item
            const item = new Item({
                name: name.trim(),
                productDetails: productDetails.trim(),
                price: derivedPrice,
                category: category.trim(),
                imageUrl: imageUrl,
                videoUrl: videoUrl,
                quantity: derivedQuantity,
                unit: unit ? String(unit).trim() : undefined,
                variants: parsedVariants,
                sellerId: user._id,
                sellerName: user.name,
                storeName: user.storeName || user.name,
                discount: parseFloat(discount),
                tax: parseFloat(tax),
                hasVAT: hasVAT === "true" || hasVAT === true,
                isAvailable: true,
                isSpecialItem: isSpecialItem === "true" || isSpecialItem === true,
            });

            const savedItem = await item.save();
            console.log("Item saved with imageUrl:", savedItem.imageUrl);

            res.status(201).json({
                success: true,
                message: "Product added successfully by admin!",
                item: savedItem,
            });
        } catch (error) {
            console.error("Admin add item upload error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to add product. Please try again.",
                error:
                    process.env.NODE_ENV === "development" ? error.message : undefined,
            });
        }
    }
);


// Admin: Get Single Product by ID
app.get(
    "/api/admin/items/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const itemId = req.params.id;
            const item = await Item.findById(itemId);
            if (!item) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }
            res.json({ success: true, item });
        } catch (error) {
            console.error("Get single item error:", error);
            res.status(500).json({ success: false, message: "Failed to fetch product" });
        }
    }
);
// Admin: Update Product
app.put(
    "/api/admin/items/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const itemId = req.params.id;
            const updates = req.body;
            if ("isSpecialItem" in updates) {
                updates.isSpecialItem =
                    updates.isSpecialItem === "true" || updates.isSpecialItem === true;
            }

            // Parse variants if provided as string
            if (typeof updates.variants === "string" && updates.variants.trim()) {
                try {
                    updates.variants = JSON.parse(updates.variants);
                } catch (e) {
                    // ignore - validation will catch it later
                }
            }

            // If variants provided and valid, derive top-level price/quantity for compatibility
            if (Array.isArray(updates.variants) && updates.variants.length > 0) {
                const valid = updates.variants.every(v => v && v.label && !isNaN(Number(v.price)) && !isNaN(Number(v.quantity)));
                if (!valid) {
                    return res.status(400).json({ success: false, message: "Invalid variants array" });
                }
                // Derive top-level price as first variant price and total quantity
                updates.price = Number(updates.variants[0].price);
                updates.quantity = updates.variants.reduce((s, vv) => s + Number(vv.quantity), 0);
            }

            // Remove fields that shouldn't be updated
            delete updates.sellerId;
            delete updates.sellerName;
            delete updates.storeName;

            const updatedItem = await Item.findByIdAndUpdate(
                itemId,
                { ...updates, updatedAt: new Date() },
                { new: true }
            );

            if (!updatedItem) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found",
                });
            }

            res.json({
                success: true,
                message: "Product updated successfully!",
                item: updatedItem,
            });
        } catch (error) {
            console.error("Admin update item error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update product",
            });
        }
    }
);

// Admin: Delete Product
app.delete(
    "/api/admin/items/:id",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const itemId = req.params.id;

            const deletedItem = await Item.findByIdAndDelete(itemId);

            if (!deletedItem) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found",
                });
            }

            res.json({
                success: true,
                message: "Product deleted successfully!",
            });
        } catch (error) {
            console.error("Admin delete item error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to delete product",
            });
        }
    }
);

// Admin: Get All Products (including hidden ones)

// Fetch admin products with discount > 0 (public, no auth required)
app.get("/api/admin-products/with-discount", async (req, res) => {
    try {
        const products = await Item.find({
            discount: { $gt: 0 },
            sellerName: "admin", // Use lowercase "admin" to match your database
            isAvailable: true,
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            count: products.length,
            products,
        });
    } catch (error) {
        console.error("Fetch admin discounted products error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch admin discounted products",
        });
    }
});
};
