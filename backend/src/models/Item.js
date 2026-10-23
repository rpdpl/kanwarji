const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  productDetails: { type: String, required: true },
  price: { type: Number },
  category: { type: String, required: true },
  imageUrl: { type: String },
  images: [{ type: String, default: undefined }],
  videoUrl: { type: String },
  quantity: { type: Number },
  unit: { type: String },
  variants: [
    {
      label: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true, min: 0 },
    },
  ],
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  sellerName: { type: String, required: true },
  storeName: { type: String },
  isAvailable: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  hasVAT: { type: Boolean, default: false },
  isSpecialItem: { type: Boolean, default: false },
});

module.exports = mongoose.model("Item", itemSchema);
