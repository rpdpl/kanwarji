import React from "react";

export default function ShippingModeCard({
  hasAddress,
  quickEligible,
  shippingMode,
  onSelectMode,
  shippingLoading,
  selectedCourier,
}) {
  if (!hasAddress) return null;

  const busy = !!shippingLoading;

  return (
    <div className="mt-4 bg-white rounded-xl shadow p-4 border border-[#ffecec]">
      <div className="font-semibold mb-1">Delivery option</div>
      <p className="text-xs text-gray-500 mb-3">
        Same day delivery is faster local delivery in Delhi based on your
        pincode. Standard ships across India through our courier partners.
      </p>
      {!quickEligible && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
          Same day delivery isn&apos;t available for this location. Standard
          shipping is selected.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy || !quickEligible}
          onClick={() => onSelectMode("quick")}
          className={`text-left rounded-xl border-2 p-3 transition ${
            shippingMode === "quick"
              ? "border-red-500 bg-red-50"
              : "border-gray-200 hover:border-gray-300"
          } ${busy || !quickEligible ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <div className="font-semibold text-gray-900">Same day delivery</div>
          <div className="text-xs text-gray-600 mt-1">
            Faster local delivery in Delhi, based on your pincode
          </div>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSelectMode("standard")}
          className={`text-left rounded-xl border-2 p-3 transition ${
            shippingMode === "standard"
              ? "border-red-500 bg-red-50"
              : "border-gray-200 hover:border-gray-300"
          } ${busy ? "opacity-60" : ""}`}
        >
          <div className="font-semibold text-gray-900">Standard shipping</div>
          <div className="text-xs text-gray-600 mt-1">
            Nationwide courier delivery
          </div>
        </button>
      </div>
      {selectedCourier?.courier_name && (
        <div className="mt-3 text-xs text-gray-600">
          Selected:{" "}
          <span className="font-medium text-gray-800">
            {selectedCourier.courier_name}
          </span>
          {selectedCourier.rate != null && (
            <> · ₹{Math.ceil(Number(selectedCourier.rate))}</>
          )}
        </div>
      )}
    </div>
  );
}
