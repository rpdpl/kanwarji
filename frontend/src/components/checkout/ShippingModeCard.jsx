import React from "react";

export default function ShippingModeCard({
  quickEligible,
  shippingMode,
  onSelectMode,
  gpsLoading,
  shippingLoading,
  deliveryLat,
  deliveryLong,
  selectedCourier,
}) {
  if (!quickEligible) return null;

  const busy = gpsLoading || shippingLoading;

  return (
    <div className="mt-4 bg-white rounded-xl shadow p-4 border border-[#ffecec]">
      <div className="font-semibold mb-1">Delivery option</div>
      <p className="text-xs text-gray-500 mb-3">
        Quick uses your phone location for same-city delivery. Standard uses
        nationwide courier rates.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSelectMode("quick")}
          className={`text-left rounded-xl border-2 p-3 transition ${
            shippingMode === "quick"
              ? "border-red-500 bg-red-50"
              : "border-gray-200 hover:border-gray-300"
          } ${busy ? "opacity-60" : ""}`}
        >
          <div className="font-semibold text-gray-900">Quick delivery</div>
          <div className="text-xs text-gray-600 mt-1">
            Hyperlocal · needs GPS permission
          </div>
          {shippingMode === "quick" && Number.isFinite(deliveryLat) && (
            <div className="text-[11px] text-gray-500 mt-2">
              Location: {deliveryLat.toFixed(5)}, {Number(deliveryLong).toFixed(5)}
            </div>
          )}
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
            Nationwide Shiprocket courier
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
      {gpsLoading && (
        <div className="mt-2 text-xs text-gray-500">Getting your location…</div>
      )}
    </div>
  );
}
