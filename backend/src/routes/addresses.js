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


module.exports = function registerAddressesRoutes(app) {
app.get("/api/addresses", authenticateToken, async (req, res) => {
    try {
        const addresses = await Address.find({ userId: req.user.id })
            .sort({ isDefault: -1, createdAt: -1 })
            .limit(3); // Limit to 3 addresses as per frontend
        res.json({
            success: true,
            addresses,
        });
    } catch (error) {
        console.error("Get addresses error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch addresses",
        });
    }
});

// Add new address
app.post("/api/addresses", authenticateToken, async (req, res) => {
    try {
        const { title, name, phone, address, city, state, pincode, isDefault } =
            req.body;
        const allowedTitles = new Set(["home", "office", "other"]);
        const titleNorm = String(title || "").trim();
        const phoneDigits = String(phone || "").replace(/\D/g, "");
        const addressNorm = String(address || "").trim();
        const cityNorm = String(city || "").trim();
        const stateNorm = String(state || "").trim();
        const pincodeDigits = String(pincode || "").replace(/\D/g, "");
        // Validate required fields
        if (!titleNorm || !name || !phoneDigits || !addressNorm || !cityNorm || !stateNorm || !pincodeDigits) {
            return res.status(400).json({
                success: false,
                message: "All address fields are required",
            });
        }
        // Validate title whitelist
        if (!allowedTitles.has(titleNorm.toLowerCase())) {
            return res.status(400).json({ success: false, message: "Title must be Home, Office, or Other" });
        }
        // Validate pincode
        if (pincodeDigits.length !== 6) {
            return res.status(400).json({
                success: false,
                message: "Pincode must be 6 digits",
            });
        }
        // Validate phone
        if (phoneDigits.length !== 10) {
            return res.status(400).json({
                success: false,
                message: "Phone number must be exactly 10 digits",
            });
        }
        // Validate min lengths
        if (addressNorm.length < 10) {
            return res.status(400).json({ success: false, message: "Address must be at least 10 characters" });
        }
        if (cityNorm.length < 3) {
            return res.status(400).json({ success: false, message: "City must be at least 3 characters" });
        }
        if (stateNorm.length < 3) {
            return res.status(400).json({ success: false, message: "State must be at least 3 characters" });
        }
        // Check if user already has 3 addresses
        const existingAddresses = await Address.countDocuments({
            userId: req.user.id,
        });
        if (existingAddresses >= 3) {
            return res.status(400).json({
                success: false,
                message: "Maximum 3 addresses allowed per user",
            });
        }
        // If this is set as default, remove default from other addresses
        if (isDefault) {
            await Address.updateMany({ userId: req.user.id }, { isDefault: false });
        }
        // If this is the first address, make it default
        const shouldBeDefault = existingAddresses === 0 || isDefault;
        const newAddress = new Address({
            userId: req.user.id,
            title: titleNorm,
            name,
            phone: phoneDigits,
            address: addressNorm,
            city: cityNorm,
            state: stateNorm,
            pincode: pincodeDigits,
            isDefault: shouldBeDefault,
        });
        await newAddress.save();
        res.status(201).json({
            success: true,
            message: "Address added successfully",
            address: newAddress,
        });
    } catch (error) {
        console.error("Add address error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add address",
        });
    }
});

// Update address
app.put("/api/addresses/:id", authenticateToken, async (req, res) => {
    try {
        const addressId = req.params.id;
        const { title, name, phone, address, city, state, pincode, isDefault } =
            req.body;
        const allowedTitles = new Set(["home", "office", "other"]);
        const titleNorm = String(title || "").trim();
        const phoneDigits = String(phone || "").replace(/\D/g, "");
        const addressNorm = String(address || "").trim();
        const cityNorm = String(city || "").trim();
        const stateNorm = String(state || "").trim();
        const pincodeDigits = String(pincode || "").replace(/\D/g, "");
        const existingAddress = await Address.findOne({
            _id: addressId,
            userId: req.user.id,
        });
        if (!existingAddress) {
            return res.status(404).json({
                success: false,
                message: "Address not found",
            });
        }
        // Basic validations
        if (!titleNorm || !name || !phoneDigits || !addressNorm || !cityNorm || !stateNorm || !pincodeDigits) {
            return res.status(400).json({ success: false, message: "All address fields are required" });
        }
        if (!allowedTitles.has(titleNorm.toLowerCase())) {
            return res.status(400).json({ success: false, message: "Title must be Home, Office, or Other" });
        }
        if (phoneDigits.length !== 10) {
            return res.status(400).json({ success: false, message: "Phone number must be exactly 10 digits" });
        }
        if (pincodeDigits.length !== 6) {
            return res.status(400).json({ success: false, message: "Pincode must be 6 digits" });
        }
        if (addressNorm.length < 10) {
            return res.status(400).json({ success: false, message: "Address must be at least 10 characters" });
        }
        if (cityNorm.length < 3) {
            return res.status(400).json({ success: false, message: "City must be at least 3 characters" });
        }
        if (stateNorm.length < 3) {
            return res.status(400).json({ success: false, message: "State must be at least 3 characters" });
        }

        // If setting as default, remove default from other addresses
        if (isDefault && !existingAddress.isDefault) {
            await Address.updateMany(
                { userId: req.user.id, _id: { $ne: addressId } },
                { isDefault: false }
            );
        }
        const updatedAddress = await Address.findByIdAndUpdate(
            addressId,
            {
                title: titleNorm,
                name,
                phone: phoneDigits,
                address: addressNorm,
                city: cityNorm,
                state: stateNorm,
                pincode: pincodeDigits,
                isDefault,
                updatedAt: new Date(),
            },
            { new: true }
        );
        res.json({
            success: true,
            message: "Address updated successfully",
            address: updatedAddress,
        });
    } catch (error) {
        console.error("Update address error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update address",
        });
    }
});

// Delete address
app.delete("/api/addresses/:id", authenticateToken, async (req, res) => {
    try {
        const addressId = req.params.id;
        const address = await Address.findOneAndDelete({
            _id: addressId,
            userId: req.user.id,
        });
        if (!address) {
            return res.status(404).json({
                success: false,
                message: "Address not found",
            });
        }
        // If deleted address was default, make another address default
        if (address.isDefault) {
            const firstAddress = await Address.findOne({ userId: req.user.id });
            if (firstAddress) {
                firstAddress.isDefault = true;
                await firstAddress.save();
            }
        }
        res.json({
            success: true,
            message: "Address deleted successfully",
        });
    } catch (error) {
        console.error("Delete address error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete address",
        });
    }
});

// =============================================================================
// AUTHENTICATION APIs
// =============================================================================

// User Info Update API
app.put("/api/user/update-info", authenticateToken, async (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!name && !phone) {
            return res
                .status(400)
                .json({ success: false, message: "Nothing to update" });
        }
        if (phone) {
            const phoneExists = await User.findOne({
                phone,
                _id: { $ne: req.user.id },
            });
            if (phoneExists) {
                return res
                    .status(400)
                    .json({ success: false, message: "Phone number already exists." });
            }
        }
        const user = await User.findById(req.user.id);
        if (!user)
            return res
                .status(404)
                .json({ success: false, message: "User not found" });
        if (name) user.name = name;
        if (phone) user.phone = phone;
        user.updatedAt = new Date();
        await user.save();
        res.json({
            success: true,
            message: "User information updated successfully",
            user: {
                id: user._id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                userType: user.userType,
            },
        });
    } catch (error) {
        console.error("Update info error:", error);
        res
            .status(500)
            .json({ success: false, message: "Failed to update user info" });
    }
});

};
