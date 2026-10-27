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


module.exports = function registerCartRoutes(app) {
app.get("/api/cart/:userId", authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        // Verify user can only access their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.json({
                success: true,
                cartItems: [],
                totalItems: 0,
                totalPrice: 0,
            });
        }

        // Calculate totals with discount and tax
        const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = cart.items.reduce((sum, item) => {
            const originalPrice = item.price;
            const discountedPrice = originalPrice * (1 - (item.discount || 0) / 100);
            const finalPrice = discountedPrice * (1 + (item.tax || 0) / 100);
            return sum + finalPrice * item.quantity;
        }, 0);

        res.json({
            success: true,
            cartItems: cart.items.map((item) => ({
                _id: item.productId,
                productId: item.productId,
                name: item.name,
                price: item.price,
                imageUrl: item.imageUrl,
                category: item.category,
                unit: item.unit,
                quantity: item.quantity,
                discount: item.discount || 0,
                tax: item.tax || 0,
                hasVAT: item.hasVAT || false,
                addedAt: item.addedAt,
            })),
            totalItems,
            totalPrice: Math.round(totalPrice * 100) / 100, // Round to 2 decimal places
        });
    } catch (error) {
        console.error("Get cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch cart items",
        });
    }
});

// Add item to user's cart
app.post("/api/cart/add", authenticateToken, async (req, res) => {
    try {
        const { userId, productId, quantity = 1, unit, variantLabel, priceOverride } = req.body;

        // Verify user can only modify their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        // Fetch complete product data from database
        const product = await Item.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        // Find or create cart for user
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({
                userId,
                items: [],
            });
        }

        // Build identity fields for variant-aware carts
        const targetUnit = unit || product.unit || "";
        const targetVariant = variantLabel || "";
        // Check if variant-specific item already exists in cart
        const existingItemIndex = cart.items.findIndex(
            (item) => item.productId === productId && (String(item.unit || "") === String(targetUnit)) && (String(item.variantLabel || "") === String(targetVariant))
        );
        if (existingItemIndex > -1) {
            // Update quantity if item exists
            cart.items[existingItemIndex].quantity += quantity;
            cart.items[existingItemIndex].addedAt = new Date();
            // Update with latest product data
            cart.items[existingItemIndex].discount = product.discount || 0;
            cart.items[existingItemIndex].tax = product.tax || 0;
            cart.items[existingItemIndex].hasVAT = product.hasVAT || false;
            // Respect price override if provided
            const overrideNum = Number(priceOverride);
            if (!isNaN(overrideNum) && overrideNum > 0) {
                cart.items[existingItemIndex].price = overrideNum;
            }
            // Update unit/variantLabel if provided
            cart.items[existingItemIndex].unit = targetUnit;
            if (targetVariant) cart.items[existingItemIndex].variantLabel = targetVariant;
        } else {
            // Add new item to cart with complete product data
            cart.items.push({
                productId,
                name: product.name,
                // Use priceOverride if provided, otherwise product.price
                price: (!isNaN(Number(priceOverride)) && Number(priceOverride) > 0) ? Number(priceOverride) : product.price,
                imageUrl: product.imageUrl || "",
                category: product.category || "",
                unit: targetUnit,
                quantity: Number.parseInt(quantity),
                discount: product.discount || 0,
                tax: product.tax || 0,
                hasVAT: product.hasVAT || false,
                addedAt: new Date(),
                ...(targetVariant ? { variantLabel: targetVariant } : {}),
            });
        }

        cart.updatedAt = new Date();
        await cart.save();

        res.json({
            success: true,
            message: "Item added to cart successfully",
            cartItemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        });
    } catch (error) {
        console.error("Add to cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add item to cart",
        });
    }
});

// Remove item from user's cart
app.delete("/api/cart/remove", authenticateToken, async (req, res) => {
    try {
        const { userId, productId, unit, variantLabel } = req.body;
        // Verify user can only modify their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found",
            });
        }
        // Find and remove the item (variant-aware)
        const itemIndex = cart.items.findIndex(
            (item) => item.productId === productId && (typeof unit === 'undefined' || String(item.unit || '') === String(unit || '')) && (typeof variantLabel === 'undefined' || String(item.variantLabel || '') === String(variantLabel || ''))
        );
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart",
            });
        }
        cart.items.splice(itemIndex, 1);
        cart.updatedAt = new Date();
        // If cart is empty, you might want to delete the cart document
        if (cart.items.length === 0) {
            await Cart.deleteOne({ userId });
        } else {
            await cart.save();
        }
        res.json({
            success: true,
            message: "Item removed from cart successfully",
            cartItemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        });
    } catch (error) {
        console.error("Remove from cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove item from cart",
        });
    }
});






































// Update item quantity in user's cart
app.put("/api/cart/update", authenticateToken, async (req, res) => {  // Mark async here
    try {
        const { userId, productId, quantity, pincode, unit, variantLabel } = req.body;  // Add pincode & variant info
        // Verify user can only modify their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }
        if (!quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be at least 1",
            });
        }
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: "Cart not found",
            });
        }
        // Find and update the item (variant-aware)
        const itemIndex = cart.items.findIndex(
            (item) => item.productId === productId && (typeof unit === 'undefined' || String(item.unit || '') === String(unit || '')) && (typeof variantLabel === 'undefined' || String(item.variantLabel || '') === String(variantLabel || ''))
        );
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Item not found in cart",
            });
        }
        cart.items[itemIndex].quantity = Number.parseInt(quantity);
        cart.items[itemIndex].addedAt = new Date(); // Update timestamp
        cart.updatedAt = new Date();
        await cart.save();

        // Calculate totalPrice (if not defined earlier—add if missing)
        const totalPrice = cart.items.reduce((sum, item) => {
            const originalPrice = item.price;
            const discountedPrice = originalPrice * (1 - (item.discount || 0) / 100);
            const finalPrice = discountedPrice * (1 + (item.tax || 0) / 100);
            return sum + finalPrice * item.quantity;
        }, 0);

        // Fetch shipping estimate if pincode provided
        let shippingEstimate = 0;
        if (pincode) {
            shippingEstimate = await getShippingEstimate(pincode);
            cart.shippingEstimate = shippingEstimate;  // Save in cart
            await cart.save();  // Save updated cart
        }

        res.json({
            success: true,
            message: "Cart updated successfully",
            cartItemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
            shippingEstimate,  // Return for UI
            totalWithShipping: Math.round((totalPrice + shippingEstimate) * 100) / 100,  // Pre-calculate with buffer
        });
    } catch (error) {
        console.error("Update cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update cart",
        });
    }
});















// Calculate shipping rate (Shiprocket)
app.post("/api/shipping-rate", async (req, res) => {
    try {
        console.log("=== Shipping Rate Calculation Started (Shiprocket) ===");
        console.log("Request body:", req.body);

        // Support both parameter formats
        const {
            destPin,
            deliveryPincode,
            pickupLocationId,
            weight = 1,
            codAmount = 0,
            orderValue = 0,
            mode = "E"
        } = req.body;

        // Use deliveryPincode if destPin is not provided
        const pincode = deliveryPincode || destPin;

        if (!pincode) {
            console.log("ERROR: No pincode provided");
            return res.status(400).json({ success: false, message: "Delivery pincode required" });
        }

        // Validate pincode format
        if (!/^\d{6}$/.test(pincode.toString())) {
            return res.status(400).json({ success: false, message: "Invalid PIN format. Must be 6 digits." });
        }

        console.log("Params: pincode=", pincode, "weight=", weight, "orderValue=", orderValue);

        // Get Shiprocket token first
        console.log("Getting Shiprocket token...");
        const token = await shiprocket.getShiprocketToken();

        if (!token) {
            throw new Error("Failed to get Shiprocket token");
        }

        console.log("✅ Token obtained, fetching rates...");

        // Call Shiprocket API directly for shipping rates
        const pickup = pickupLocationId || "110006";
        const shiprocketUrl = `https://apiv2.shiprocket.in/v1/external/courier/serviceability/?pickup_postcode=${pickup}&delivery_postcode=${pincode}&weight=${weight}`;

        console.log("Shiprocket URL:", shiprocketUrl);

        const shiprocketResponse = await axios.get(shiprocketUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        console.log("Shiprocket response received");

        if (shiprocketResponse.data.success && shiprocketResponse.data.data) {
            // Support both shapes: data.couriers and data.available_courier_companies
            const apiData = shiprocketResponse.data.data;
            const baseCouriers = Array.isArray(apiData.couriers)
                ? apiData.couriers
                : (Array.isArray(apiData.available_courier_companies) ? apiData.available_courier_companies : []);
            if (!baseCouriers.length) {
                throw new Error("No couriers available for this route from Shiprocket");
            }
            // Show Air/Express and Surface. Prefer Air/Express when auto-picking a rate.
            const allCouriers = baseCouriers;
            const airCouriers = allCouriers.filter((c) => {
                const isAirMode = Number(c?.mode) === 1;
                const notSurface = c?.is_surface === false;
                const name = String(c?.courier_name || "").toLowerCase();
                const hasAirName =
                    name.includes("air") ||
                    name.includes("express") ||
                    name.includes("speed post");
                return isAirMode || notSurface || hasAirName;
            });
            const pickFrom = airCouriers.length ? airCouriers : allCouriers;

            // Choose the fastest by earliest ETA hours; fallback to estimated_delivery_days; break ties by lower rate
            const fastest = pickFrom.reduce((best, cur) => {
                const bestEta = Number((best.etd_hours ?? (best.estimated_delivery_days != null ? Number(best.estimated_delivery_days) * 24 : undefined)))
                    || Number.POSITIVE_INFINITY;
                const curEta = Number((cur.etd_hours ?? (cur.estimated_delivery_days != null ? Number(cur.estimated_delivery_days) * 24 : undefined)))
                    || Number.POSITIVE_INFINITY;

                if (curEta < bestEta) return cur;
                if (curEta > bestEta) return best;
                // Tie on ETA: pick cheaper
                return (Number(cur.rate) < Number(best.rate)) ? cur : best;
            }, pickFrom[0]);

            const shippingCost = fastest.rate;

            console.log("✅ Fastest courier selected: ₹", shippingCost, "via", fastest.courier_name);
            console.log("=== Shipping Rate Calculation Complete ===");

            return res.json({
                success: true,
                shippingCost,
                message: `Shipping to PIN ${pincode}: ₹${shippingCost} via ${fastest.courier_name}`,
                details: fastest,
                couriers: allCouriers,
                // Provide a Shiprocket-compatible data shape (Air + Surface)
                data: {
                    available_courier_companies: allCouriers,
                    recommended_courier_company_id: fastest.courier_company_id,
                    shiprocket_recommended_courier_id: fastest.courier_company_id,
                    // Add nested data block for clients expecting Shiprocket's nested shape
                    // Also mirror to couriers for clients reading this key
                    data: {
                        available_courier_companies: allCouriers,
                        recommended_courier_company_id: fastest.courier_company_id,
                        shiprocket_recommended_courier_id: fastest.courier_company_id,
                        // Also mirror to couriers for clients reading this key
                        couriers: allCouriers,
                    },
                    // Also expose at this level for clients reading `couriers`
                    couriers: allCouriers,
                },
            });
        } else {
            throw new Error("No couriers available for this route from Shiprocket");
        }
    } catch (error) {
        console.error("=== Shipping Rate Error ===");
        console.error("Status:", error.response?.status);
        console.error("Error Response:", error.response?.data);
        console.error("Message:", error.message);
        console.log("=== End Error ===");

        res.status(500).json({
            success: false,
            message: error.message || "Failed to calculate shipping rate",
            error: error.response?.data || error.message,
        });
    }
});



































// Clear user's entire cart
app.delete("/api/cart/clear/:userId", authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        // Verify user can only modify their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }
        await Cart.deleteOne({ userId });
        res.json({
            success: true,
            message: "Cart cleared successfully",
            cartItemCount: 0,
        });
    } catch (error) {
        console.error("Clear cart error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear cart",
        });
    }
});

// Get cart item count for user (utility endpoint)
app.get("/api/cart/:userId/count", authenticateToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        // Verify user can only access their own cart
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }
        const cart = await Cart.findOne({ userId });
        const count = cart
            ? cart.items.reduce((sum, item) => sum + item.quantity, 0)
            : 0;
        res.json({
            success: true,
            count,
        });
    } catch (error) {
        console.error("Get cart count error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get cart count",
        });
    }
});

// =============================================================================
// ADDRESS MANAGEMENT APIs
// =============================================================================

};
