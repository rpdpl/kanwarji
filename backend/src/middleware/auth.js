const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { JWT_SECRET } = require("../config/env");

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Access token required" });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error verifying admin status",
    });
  }
};

module.exports = { authenticateToken, requireAdmin };
