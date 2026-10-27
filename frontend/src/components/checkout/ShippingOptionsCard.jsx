import React from "react";

export default function ShippingOptionsCard({
  needsAddress,
  shippingOptions = [],
  selectedOptionId,
  onSelectOption,
  shippingLoading,
  shippingError,
}) {
  const busy = !!shippingLoading;
  const interactive = !needsAddress && !busy && shippingOptions.length > 0;

  return (
    <div className="mt-4 bg-white rounded-xl shadow p-4 border border-[#ffecec]">
      <div className="font-semibold mb-1">Shipping</div>
      <p className="text-xs text-gray-500 mb-3">
        Choose how your order should be delivered. Prices update for the address
        you select.
      </p>

      {needsAddress && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
          <div className="font-medium text-gray-800">Standard shipping</div>
          <p className="text-xs text-gray-500 mt-1">
            Select a delivery address to see courier options and prices.
          </p>
          <div className="mt-3 space-y-2 opacity-50 pointer-events-none">
            <div className="h-14 rounded-lg bg-gray-200/70" />
            <div className="h-14 rounded-lg bg-gray-200/70" />
          </div>
        </div>
      )}

      {!needsAddress && busy && (
        <div className="text-sm text-gray-500 py-2">
          Checking delivery options for your address…
        </div>
      )}

      {!needsAddress && !busy && shippingError && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
          {shippingError}
        </p>
      )}

      {!needsAddress && !busy && shippingOptions.length > 0 && (
        <div className="space-y-2">
          {shippingOptions.map((opt) => {
            const selected = selectedOptionId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={!interactive}
                onClick={() => onSelectOption(opt)}
                className={`w-full text-left rounded-xl border-2 p-3 transition ${
                  selected
                    ? "border-red-500 bg-red-50"
                    : "border-gray-200 hover:border-gray-300"
                } ${!interactive ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">{opt.label}</div>
                    {opt.eta ? (
                      <div className="text-xs text-gray-600 mt-1">{opt.eta}</div>
                    ) : null}
                    {opt.mode === "quick" ? (
                      <div className="text-[11px] text-gray-500 mt-1">
                        Faster local delivery in Delhi, based on your pincode
                      </div>
                    ) : null}
                  </div>
                  <div className="shrink-0 font-semibold text-gray-900">
                    ₹{opt.rate}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!needsAddress && !busy && !shippingError && shippingOptions.length === 0 && (
        <p className="text-sm text-gray-500 py-2">
          No delivery options available for this address yet.
        </p>
      )}
    </div>
  );
}
