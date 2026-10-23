const mongoose = require("mongoose");

const sellerRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  userEmail: { type: String, required: true },
  storeName: { type: String, required: true },
  storeAddress: { type: String, required: true },
  businessLicense: { type: String },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  rejectionReason: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SellerRequest", sellerRequestSchema);
