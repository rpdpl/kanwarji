import React from "react";

export default function CartItemsCard({
  cart,
  specialRequest,
  setSpecialRequest,
  clientSubtotal,
  taxAmount,
  shippingLoading,
  shippingError,
  shippingFee,
  expectedEtaText,
  savings,
  totalAmount,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 border border-[#ffecec]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-red-500 text-xl">🛒</div>
          <div>
            <div className="font-semibold">
              Cart Items ({cart.totalItems || (cart.cartItems || []).length})
            </div>
            <div className="text-sm text-gray-500">
              Review items before payment
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {(cart.cartItems || []).map((item) => (
          <div
            key={item._id || item.id || item.name}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="w-16 h-16 rounded-lg bg-pink-50 flex items-center justify-center flex-shrink-0">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="text-pink-400 text-xl">🬬</div>
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-800">
                {item.name}{" "}
                {item.unit ? (
                  <span className="text-sm text-gray-500">({item.unit})</span>
                ) : null}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                ₹{Number(item.price || 0).toFixed(2)} each
                {item.unit ? (
                  <>
                    <span> • {item.unit}</span>
                  </>
                ) : null}{" "}
                × {item.quantity || 1}
              </div>
              {item.originalPrice && item.originalPrice > item.price && (
                <div className="text-xs text-red-500 mt-1">
                  Save ₹
                  {(
                    (item.originalPrice - item.price) *
                    item.quantity
                  ).toFixed(2)}
                </div>
              )}
              {Number(item.tax || 0) > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Tax: ₹
                  {(
                    Number(item.price || 0) *
                    (1 - (Number(item.discount || 0) || 0) / 100) *
                    (item.quantity || 0) *
                    (Number(item.tax || 0) / 100)
                  ).toFixed(2)}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="font-medium text-lg">
                ₹{(Number(item.price || 0) * (item.quantity || 1)).toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Special Request (Optional)
        </label>
        <textarea
          value={specialRequest}
          onChange={(e) => setSpecialRequest(e.target.value)}
          placeholder="Any special instructions for your order..."
          className="w-full p-3 border rounded-lg text-sm resize-none"
          rows="3"
        />
      </div>

      <div className="mt-4 pt-4 border-t space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal ({(cart.cartItems || []).length} items)</span>
          <span>₹{clientSubtotal.toFixed(2)}</span>
        </div>
        {taxAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span>Tax</span>
            <span>₹{taxAmount.toFixed(2)}</span>
          </div>
        )}
        {shippingLoading && (
          <div className="flex justify-between text-sm text-gray-500">
            <span>Shipping Fee</span>
            <span>Calculating...</span>
          </div>
        )}
        {!shippingLoading && shippingError && (
          <div className="flex justify-between text-sm text-red-600">
            <span>Shipping Fee</span>
            <span>{shippingError}</span>
          </div>
        )}
        {!shippingLoading && !shippingError && shippingFee > 0 && (
          <div className="flex justify-between text-sm">
            <span>Shipping Fee</span>
            <span>₹{shippingFee.toFixed(2)}</span>
          </div>
        )}
        {!shippingLoading && !shippingError && expectedEtaText && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Expected Delivery</span>
            <span>{expectedEtaText}</span>
          </div>
        )}
        {!shippingLoading && !shippingError && shippingFee === 0 && (
          <div className="flex justify-between text-sm font-bold text-red-600">
            <span>Shipping Fee</span>
            <span>
              Local Delivery Charges Payable at time of delivery, depending on
              distance.
            </span>
          </div>
        )}
        {savings > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>You Save</span>
            <span>-₹{savings.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-gray-600 pt-2 border-t">
          <span>Total</span>
          <span>₹{totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
