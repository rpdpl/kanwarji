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


module.exports = function registerAuthRoutes(app) {
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const existingUser = await User.findOne({
            $or: [{ email }, { phone }],
        });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email or phone number.",
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name,
            email,
            phone,
            password: hashedPassword,
            userType: "buyer",
            isVerified: false,
        });
        await user.save();
        const otp = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);
        await OTP.deleteMany({ email });
        const otpDoc = new OTP({
            email,
            otp,
            expiresAt,
        });
        await otpDoc.save();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Signup OTP Verification",
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">OTP Verification</h2>
          <p>Hello ${name},</p>
          <p>Your OTP for verifying your account is:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP will expire in 15 minutes.</p>
          <p>If you did not sign up, please ignore this email.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
            This is an automated email. Please do not reply.
          </p>
        </div>
      `,
        };
        await sendMail(mailOptions);
        res.status(201).json({
            success: true,
            message: "Account created! Please verify your email with the OTP sent.",
        });
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred during signup. Please try again.",
        });
    }
});

// Verify Signup OTP
app.post("/api/auth/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            });
        }
        const otpDoc = await OTP.findOne({ email, otp });
        if (!otpDoc) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
            });
        }
        if (new Date() > otpDoc.expiresAt) {
            await OTP.deleteOne({ _id: otpDoc._id });
            return res.status(400).json({
                success: false,
                message: "OTP has expired",
            });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        user.isVerified = true;
        user.updatedAt = new Date();
        await user.save();
        await OTP.deleteOne({ _id: otpDoc._id });
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || "your-secret-key",
            {
                expiresIn: "7d",
            }
        );
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            profileImage: user.profileImage,
            createdAt: user.createdAt,
            isVerified: user.isVerified,
        };
        res.json({
            success: true,
            message: "Email verified successfully!",
            user: userData,
            token,
        });
    } catch (error) {
        console.error("Verify signup otp error:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while verifying OTP",
        });
    }
});

// Send OTP for password reset
app.post("/api/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: "Email is required",
            });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "No user found with this email address",
            });
        }
        const otp = generateOTP();
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15);
        await OTP.deleteMany({ email });
        const otpDoc = new OTP({
            email,
            otp,
            expiresAt,
        });
        await otpDoc.save();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset OTP",
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333; text-align: center;">Password Reset</h2>
          <p>Hello ${user.name},</p>
          <p>You requested to reset your password. Please use the following OTP to verify your identity:</p>
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This OTP will expire in 15 minutes.</p>
          <p>If you didn't request this password reset, please ignore this email or contact support if you have concerns.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #777; text-align: center;">
            This is an automated email. Please do not reply.
          </p>
        </div>
      `,
        };
        await sendMail(mailOptions);
        res.status(200).json({
            success: true,
            message: "OTP sent to your email address",
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({
            success: false,
            error: "An error occurred while processing your request",
        });
    }
});

// Verify OTP for password reset
app.post("/api/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                error: "Email and OTP are required",
            });
        }
        const otpDoc = await OTP.findOne({ email, otp });
        if (!otpDoc) {
            return res.status(400).json({
                success: false,
                error: "Invalid OTP",
            });
        }
        if (new Date() > otpDoc.expiresAt) {
            await OTP.deleteOne({ _id: otpDoc._id });
            return res.status(400).json({
                success: false,
                error: "OTP has expired",
            });
        }
        const token = crypto.randomBytes(32).toString("hex");
        otpDoc.token = token;
        otpDoc.expiresAt = new Date();
        otpDoc.expiresAt.setMinutes(otpDoc.expiresAt.getMinutes() + 30);
        await otpDoc.save();
        res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            token,
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        res.status(500).json({
            success: false,
            error: "An error occurred while verifying OTP",
        });
    }
});

// Reset password with token
app.post("/api/reset-password", async (req, res) => {
    try {
        const { email, token, password } = req.body;
        if (!email || !token || !password) {
            return res.status(400).json({
                success: false,
                error: "Email, token and password are required",
            });
        }
        const otpDoc = await OTP.findOne({ email, token });
        if (!otpDoc) {
            return res.status(400).json({
                success: false,
                error: "Invalid or expired token",
            });
        }
        if (new Date() > otpDoc.expiresAt) {
            await OTP.deleteOne({ _id: otpDoc._id });
            return res.status(400).json({
                success: false,
                error: "Reset token has expired",
            });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found",
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;
        user.updatedAt = new Date();
        await user.save();
        await OTP.deleteOne({ _id: otpDoc._id });
        res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({
            success: false,
            error: "An error occurred while resetting password",
        });
    }
});

// Login User
app.post("/api/auth/login", async (req, res) => {
    try {
        const { emailOrPhone, password } = req.body;
        const user = await User.findOne({
            $or: [
                { email: emailOrPhone },
                { phone: emailOrPhone },
                { name: emailOrPhone },
            ],
        });
        if (!user) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid credentials. Please check your email/phone and password.",
            });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid credentials. Please check your email/phone and password.",
            });
        }
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || "your-secret-key",
            {
                expiresIn: "7d",
            }
        );
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            profileImage: user.profileImage,
            storeName: user.storeName,
            storeAddress: user.storeAddress,
            isVerified: user.isVerified,
            isActive: user.isActive,
            createdAt: user.createdAt,
        };
        res.json({
            success: true,
            message: "Login successful!",
            user: userData,
            token,
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred during login. Please try again.",
        });
    }
});

// Get Current User
app.get("/api/auth/me", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            profileImage: user.profileImage,
            storeName: user.storeName,
            storeAddress: user.storeAddress,
            businessLicense: user.businessLicense,
            isVerified: user.isVerified,
            isActive: user.isActive,
            sellerRequestStatus: user.sellerRequestStatus,
            createdAt: user.createdAt,
        };
        res.json({
            success: true,
            user: userData,
        });
    } catch (error) {
        console.error("Get user error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get user data",
        });
    }
});

// Become Seller - Updated to create seller request instead of direct conversion
app.post("/api/auth/become-seller", authenticateToken, async (req, res) => {
    try {
        const { storeName, storeAddress, businessLicense } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        // Check if user already has a pending or approved request
        const existingRequest = await SellerRequest.findOne({
            userId: user._id,
            status: { $in: ["pending", "approved"] },
        });
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: `You already have a ${existingRequest.status} seller request.`,
            });
        }
        if (user.userType === "seller") {
            return res.status(400).json({
                success: false,
                message: "You are already a seller.",
            });
        }
        // Create seller request
        const sellerRequest = new SellerRequest({
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            storeName,
            storeAddress,
            businessLicense,
        });
        await sellerRequest.save();
        // Update user status
        user.sellerRequestStatus = "pending";
        user.updatedAt = new Date();
        await user.save();
        res.json({
            success: true,
            message:
                "Seller request submitted successfully! Please wait for admin approval.",
            request: {
                id: sellerRequest._id,
                status: sellerRequest.status,
                createdAt: sellerRequest.createdAt,
            },
        });
    } catch (error) {
        console.error("Become seller error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to submit seller request. Please try again.",
        });
    }
});

// =============================================================================
// ADMIN ROUTES
// =============================================================================


app.post("/api/auth/facebook", async (req, res) => {
    try {
        const { accessToken } = req.body;
        if (!accessToken)
            return res
                .status(400)
                .json({ success: false, message: "No accessToken provided" });

        // Verify token and get user info
        const fbRes = await fetch(
            `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`
        );
        const fbData = await fbRes.json();
        if (!fbData.email) {
            return res
                .status(400)
                .json({ success: false, message: "Facebook account has no email" });
        }

        // Find or create user
        let user = await User.findOne({ email: fbData.email });
        if (!user) {
            user = new User({
                name: fbData.name,
                email: fbData.email,
                phone: "", // You may want to ask for phone later
                password: "", // Not needed for OAuth
                userType: "buyer",
                isVerified: true,
                profileImage: fbData.picture?.data?.url,
            });
            await user.save();
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET || "your-secret-key",
            {
                expiresIn: "7d",
            }
        );

        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            userType: user.userType,
            profileImage: user.profileImage,
            isVerified: user.isVerified,
            isActive: user.isActive,
            createdAt: user.createdAt,
        };

        res.json({
            success: true,
            message: "Facebook login successful!",
            user: userData,
            token,
        });
    } catch (error) {
        console.error("Facebook OAuth error:", error);
        res.status(500).json({ success: false, message: "Facebook login failed" });
    }
});

};
