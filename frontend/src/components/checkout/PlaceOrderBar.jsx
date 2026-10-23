import React from "react";

export default function PlaceOrderBar({
  totalAmount,
  savings,
  placeOrder,
  selectedAddressId,
  cart,
  placingOrder,
  shippingLoading,
  shippingError,
}) {
  return (
    <div
      className="fixed left-0 right-0 bottom-0 p-4 shadow-lg"
      style={{ backgroundColor: "#FFF5F5" }}
    >
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl p-4 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-gray-500">Total Amount</div>
            <div
              className="text-xl font-bold"
              style={{ color: "rgba(4, 4, 4, 1)" }}
            >
              ₹{totalAmount.toFixed(2)}
            </div>
            {savings > 0 && (
              <div className="text-xs text-green-600 font-semibold">
                You saved ₹{savings.toFixed(2)}
              </div>
            )}
          </div>
          <button
            onClick={placeOrder}
            disabled={
              !selectedAddressId ||
              (cart.cartItems || []).length === 0 ||
              placingOrder ||
              shippingLoading ||
              !!shippingError
            }
            className="text-white px-8 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2 shadow-soft hover:shadow-card border-2"
            style={{
              backgroundColor: "rgb(238, 34, 37)",
              borderColor: "rgb(200, 20, 22)",
            }}
          >
            {placingOrder ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {"Processing Payment..."}
              </>
            ) : (
              "Place Order"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
