const mongoose = require("mongoose");

const cancellationRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  orderIdStr: { type: String, required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },
  cancellationReason: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  paymentStatus: { type: String, required: true },
  paymentId: { type: String },
  items: [
    {
      name: { type: String },
      quantity: { type: Number },
      price: { type: Number },
    },
  ],
  address: {
    name: { type: String },
    phone: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
  },
  adminRemarks: { type: String, default: "" },
  adminResponse: { type: String, default: "" },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  processedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CancellationRequest", cancellationRequestSchema);
