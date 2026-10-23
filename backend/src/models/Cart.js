const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [
    {
      productId: { type: String, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      imageUrl: { type: String },
      category: { type: String },
      unit: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      discount: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      hasVAT: { type: Boolean, default: false },
      addedAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

cartSchema.index({ userId: 1 });
cartSchema.index({ userId: 1, "items.productId": 1 });

module.exports = mongoose.model("Cart", cartSchema);
