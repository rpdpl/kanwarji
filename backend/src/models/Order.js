const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  orderId: { type: String, unique: true, required: true },
  items: [
    {
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      sellerName: { type: String },
      unit: { type: String },
      variantLabel: { type: String },
      tax: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
    },
  ],
  address: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  paymentMethod: { type: String, enum: ["cod", "online"], required: true },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending",
  },
  paymentId: { type: String },
  paymentRequestId: { type: String },
  subtotal: { type: Number, required: true },
  weight: { type: Number, default: 0 },
  shiprocketFee: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  specialRequests: { type: String, default: null, maxLength: 200 },
  remarks: { type: String, default: "", maxLength: 500 },
  convenienceFee: { type: Number, default: 0 },
  orderStatus: {
    type: String,
    enum: [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "cancellation-pending",
    ],
    default: "pending",
  },
  shiprocketOrderId: { type: String },
  awbNumber: { type: String },
  shipmentStatus: { type: String, default: "pending" },
  shiprocketError: { type: String },
  estimatedShiprocket: { type: Date },
  shiprocketAt: { type: Date },
  // quick = Hyperlocal; standard = nationwide. requested* is what checkout asked for.
  requestedShippingMode: {
    type: String,
    enum: ["quick", "standard"],
    default: "standard",
  },
  shippingMode: {
    type: String,
    enum: ["quick", "standard"],
    default: "standard",
  },
  shippingFallbackUsed: { type: Boolean, default: false },
  deliveryLat: { type: Number },
  deliveryLong: { type: Number },
  courierCompanyId: { type: String },
  courierName: { type: String },
  cancelledAt: { type: Date },
  paidAt: { type: Date },
  refundedAt: { type: Date },
  cancellationReason: { type: String },
  cancellationInitiatedBy: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
  adminRemarks: { type: String, default: "" },
  delhiveryError: { type: String, default: "" }, // legacy
  pickupRequestId: { type: String }, // legacy
  pickupStatus: { type: String, default: "pending" },
  pickupRequestError: { type: String, default: "" },
  // Legacy: old free local NCR path that skipped Shiprocket
  isLocalShiprocket: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", orderSchema);
