const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userType: {
    type: String,
    enum: ["buyer", "seller", "admin"],
    default: "buyer",
  },
  profileImage: { type: String },
  storeName: { type: String },
  storeAddress: { type: String },
  businessLicense: { type: String },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  sellerRequestStatus: {
    type: String,
    enum: ["none", "pending", "approved", "rejected"],
    default: "none",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
