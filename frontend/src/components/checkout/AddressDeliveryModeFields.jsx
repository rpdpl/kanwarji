import React from "react";
import { isPinQuickAvailable } from "../../utils/pincodeCoords";

export function isPinQuickEligible(pincode) {
  return isPinQuickAvailable(pincode);
}

export default function AddressDeliveryModeFields({
  form,
  setForm,
  pinEligible,
  warning,
}) {
  const mode = form.preferredShippingMode === "quick" ? "quick" : "standard";
  const eligible =
    typeof pinEligible === "boolean"
      ? pinEligible
      : isPinQuickAvailable(form.pincode);

  const selectMode = (next) => {
    if (next === "quick" && !eligible) {
      setForm({
        ...form,
        preferredShippingMode: "standard",
      });
      return;
    }
    setForm({
      ...form,
      preferredShippingMode: next,
    });
  };

  return (
    <div className="space-y-2">
      <div className="font-medium text-sm text-gray-800">Delivery preference</div>
      <div className="flex flex-col sm:flex-row gap-3">
        <label
          className={`flex-1 flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${
            mode === "quick" ? "border-red-500 bg-red-50" : "border-gray-200"
          } ${!eligible ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="preferredShippingMode"
            checked={mode === "quick"}
            disabled={!eligible}
            onChange={() => selectMode("quick")}
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-gray-900 block">Same day delivery</span>
            <span className="text-xs text-gray-600">
              Faster local delivery in Delhi, based on your pincode
            </span>
          </span>
        </label>
        <label
          className={`flex-1 flex items-start gap-2 p-3 rounded-lg border cursor-pointer ${
            mode === "standard" ? "border-red-500 bg-red-50" : "border-gray-200"
          }`}
        >
          <input
            type="radio"
            name="preferredShippingMode"
            checked={mode === "standard"}
            onChange={() => selectMode("standard")}
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-gray-900 block">Standard shipping</span>
            <span className="text-xs text-gray-600">Nationwide courier</span>
          </span>
        </label>
      </div>
      {(warning ||
        (!eligible &&
          String(form.pincode || "").replace(/\D/g, "").length >= 6)) && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          {warning ||
            "Same day delivery isn't available for this location. Standard shipping is selected."}
        </p>
      )}
    </div>
  );
}
