import React from "react";
import { FaTimes } from "react-icons/fa";

export default function LocalDeliveryModal({
  show,
  addresses,
  selectedAddressId,
  onClose,
}) {
  if (!show) return null;

  const handleClose = () => {
    const addr = addresses.find((a) => a._id === selectedAddressId);
    if (addr) {
      const pinRaw = (addr.pincode || "").toString().trim();
      const pin = pinRaw.replace(/\D/g, "").slice(0, 6);
      localStorage.setItem("warnedPincode", pin);
    }
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100"
          aria-label="Close notice"
        >
          <FaTimes className="text-gray-500" />
        </button>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 text-xl">
            ⚠️
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              Local Delivery Charges Notice
            </h3>
            <p className="text-sm text-gray-700">
              Delivery charges are payable at the time of delivery. This fee is
              not included in the total shown here.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleClose}
            className="px-5 py-2 rounded-xl text-white font-semibold border-2 shadow-soft"
            style={{
              backgroundColor: "rgb(238, 34, 37)",
              borderColor: "rgb(200, 20, 22)",
            }}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
