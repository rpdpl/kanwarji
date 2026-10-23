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


module.exports = function registerItemsRoutes(app) {
app.post("/api/items", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.userType !== "seller" && user.userType !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only approved sellers can add items",
            });
        }
        if (!user.isActive) {
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

// Get All Items - Updated to only show items from active sellers
app.get("/api/items", async (req, res) => {
    try {
        const { category, search, page = 1, limit = 20 } = req.query;

        // First get active sellers
        const activeSellers = await User.find({
            userType: "seller",
            isActive: true,
        }).select("_id");
        const activeSellerIds = activeSellers.map((seller) => seller._id);

        // Include items from active sellers OR admin-added items
        const query = {
            isAvailable: true,
            $or: [{ sellerId: { $in: activeSellerIds } }, { sellerName: "admin" }],
        };

        if (category) {
            query.category = { $regex: category, $options: "i" };
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { productDetails: { $regex: search, $options: "i" } },
                { category: { $regex: search, $options: "i" } },
            ];
        }

        const items = await Item.find(query)
            .select(
                "name productDetails  price category imageUrl images videoUrl quantity unit variants sellerId sellerName storeName discount tax hasVAT isAvailable createdAt updatedAt"
            ) // include images, videoUrl
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Item.countDocuments(query);

        res.json({
            success: true,
            items,
            totalPages: Math.ceil(total / limit),
            currentPage: Number.parseInt(page),
            totalItems: total,
        });
    } catch (error) {
        console.error("Get items error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch items",
        });
    }
});

// 2. Update the admin get items endpoint
app.get(
    "/api/admin/items",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { page = 1, limit = 100, category, search } = req.query;

            let query = {};
            if (category && category !== "all") {
                query.category = category;
            }
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { productDetails: { $regex: search, $options: "i" } },
                ];
            }

            const items = await Item.find(query)
                .select(
                    "name productDetails price category imageUrl images videoUrl quantity unit variants sellerId sellerName storeName discount tax hasVAT isAvailable createdAt updatedAt isSpecialItem"
                )
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await Item.countDocuments(query);

            res.json({
                success: true,
                items,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                total,
            });
        } catch (error) {
            console.error("Get items error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to fetch items",
            });
        }
    }
);

// 3. Update the admin-items public endpoint
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
            ) // Added images, videoUrl
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

// 4. Fix the admin add item endpoint to handle discount, tax, VAT properly
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
                videoUrl,
                discount = 0,
                tax = 0,
                hasVAT = false,
                isSpecialItem = false,
            } = req.body;

            // Validate required fields. Support either legacy (price+quantity+unit)
            // or new `variants` array in the body (JSON string in multipart).
            let variants = req.body.variants;
            if (typeof variants === "string" && variants.trim()) {
                try {
                    variants = JSON.parse(variants);
                } catch (e) {
                    // leave as string; will fail validation below
                }
            }

            const hasValidVariants = Array.isArray(variants) && variants.length > 0 && variants.every(v => v && v.label && !isNaN(Number(v.price)) && !isNaN(Number(v.quantity)));

            if (!name || !productDetails || !category) {
                return res.status(400).json({ success: false, message: "Name, productDetails and category are required" });
            }

            if (!hasValidVariants) {
                // fallback to legacy fields
                if (!price || !quantity || !unit) {
                    return res.status(400).json({
                        success: false,
                        message: "All required fields must be provided (either provide `variants` or price+quantity+unit)",
                    });
                }
            }

            console.log("Discount, Tax, VAT values:", { discount, tax, hasVAT });

            // Prepare variants (if provided) and derive top-level fields for compatibility
            let parsedVariants = hasValidVariants ? variants.map(v => ({ label: String(v.label).trim(), price: Number(v.price), quantity: Number(v.quantity) })) : [];

            const derivedPrice = parsedVariants.length ? parsedVariants[0].price : (price ? parseFloat(price) : undefined);
            const derivedQuantity = parsedVariants.length ? parsedVariants.reduce((s, vv) => s + Number(vv.quantity), 0) : (quantity ? parseInt(quantity) : undefined);

            // Create item with proper type conversion
            const item = new Item({
                name: name.trim(),
                productDetails: productDetails.trim(),
                price: derivedPrice,
                category: category.trim(),
                imageUrl: imageUrl || "",
                videoUrl: videoUrl || "",
                quantity: derivedQuantity,
                unit: unit ? String(unit).trim() : undefined,
                variants: parsedVariants,
                sellerId: user._id,
                sellerName: user.name,
                storeName: user.storeName || user.name,
                discount: parseFloat(discount) || 0, // Ensure it's a number
                tax: parseFloat(tax) || 0, // Ensure it's a number
                hasVAT: Boolean(hasVAT), // Ensure it's a boolean
                isAvailable: true,
                isSpecialItem: isSpecialItem === "true" || isSpecialItem === true,
            });

            const savedItem = await item.save();
            console.log("Item saved with discount/tax/VAT:", {
                discount: savedItem.discount,
                tax: savedItem.tax,
                hasVAT: savedItem.hasVAT,
                variants: savedItem.variants && savedItem.variants.length,
            });

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

// 5. Update Get Seller Items to include discount, tax, VAT
app.get("/api/items/my-items", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.userType !== "seller" && user.userType !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only sellers can view their items",
            });
        }

        const items = await Item.find({ sellerId: user._id })
            .select(
                "name productDetails  price category imageUrl quantity unit sellerId sellerName storeName discount tax hasVAT isAvailable createdAt updatedAt isSpecialItem"
            ) // Added discount, tax, hasVAT
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            items,
        });
    } catch (error) {
        console.error("Get seller items error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch your items",
        });
    }
});
// Update Item
app.put("/api/items/:id", authenticateToken, async (req, res) => {
    try {
        const item = await Item.findOne({
            _id: req.params.id,
            sellerId: req.user.id,
        });
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found or you are not authorized to update it",
            });
        }
        const updates = req.body;
        updates.updatedAt = new Date();
        const updatedItem = await Item.findByIdAndUpdate(req.params.id, updates, {
            new: true,
        });
        res.json({
            success: true,
            message: "Item updated successfully!",
            item: updatedItem,
        });
    } catch (error) {
        console.error("Update item error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update item",
        });
    }
});

// Delete Item
app.delete("/api/items/:id", authenticateToken, async (req, res) => {
    try {
        const item = await Item.findOneAndDelete({
            _id: req.params.id,
            sellerId: req.user.id,
        });
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found or you are not authorized to delete it",
            });
        }
        res.json({
            success: true,
            message: "Item deleted successfully!",
        });
    } catch (error) {
        console.error("Delete item error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete item",
        });
    }
});

// Get Categories
app.get("/api/categories", async (req, res) => {
    try {
        const categories = await Item.distinct("category");
        res.json({
            success: true,
            categories,
        });
    } catch (error) {
        console.error("Get categories error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch categories",
        });
    }
});

// =============================================================================
// ORDER MANAGEMENT APIs
// =============================================================================

};
