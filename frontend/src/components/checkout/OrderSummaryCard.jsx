import React from "react";

export default function OrderSummaryCard({
  cart,
  savings,
  clientSubtotal,
  taxAmount,
  shippingLoading,
  shippingError,
  shippingFee,
  totalAmount,
}) {
  return (
    <div className="mt-4 bg-white rounded-xl shadow p-4 border border-[#ffecec]">
      <div className="font-semibold mb-4">Order Summary</div>
      <div className="space-y-3 text-sm">
        {savings > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-600">Total Savings</span>
            <span className="font-medium text-green-600">
              ₹{savings.toFixed(2)}
            </span>
          </div>
        )}
        <hr className="border-gray-200" />
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>₹{clientSubtotal.toFixed(2)}</span>
        </div>
        {taxAmount > 0 && (
          <div className="flex justify-between">
            <span>Tax</span>
            <span>₹{taxAmount.toFixed(2)}</span>
          </div>
        )}
        {shippingLoading && (
          <div className="flex justify-between text-gray-500">
            <span>Shipping Fee</span>
            <span>Calculating...</span>
          </div>
        )}
        {!shippingLoading && shippingError && (
          <div className="flex justify-between text-red-600">
            <span>Shipping Fee</span>
            <span>{shippingError}</span>
          </div>
        )}
        {!shippingLoading && !shippingError && shippingFee > 0 && (
          <div className="flex justify-between">
            <span>Shipping Fee</span>
            <span>₹{shippingFee.toFixed(2)}</span>
          </div>
        )}
        {!shippingLoading && !shippingError && shippingFee === 0 && (
          <div className="flex justify-between">
            <span>Shipping Fee</span>
            <span>₹0.00</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-gray-600">
          <span>
            Total Amount ({cart.totalItems || (cart.cartItems || []).length}{" "}
            items)
          </span>
          <span>₹{totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
