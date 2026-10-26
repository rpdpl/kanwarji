import React from "react";
import { FaTimes } from "react-icons/fa";

export default function LocalDeliveryModal({
  show,
  addresses,
  selectedAddressId,
  onClose,
  onChooseQuick,
}) {
  if (!show) return null;

  const handleClose = () => {
    const addr = addresses.find((a) => a._id === selectedAddressId);
    if (addr) {
      const pinRaw = (addr.pincode || "").toString().trim();
      const pin = pinRaw.replace(/\D/g, "").slice(0, 6);
      localStorage.setItem("warnedQuickPin", pin);
    }
    onClose();
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
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 text-lg font-bold">
            Q
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              Quick delivery available
            </h3>
            <p className="text-sm text-gray-700">
              Your address is in Delhi / NCR. Choose{" "}
              <span className="font-semibold">Quick delivery</span> for
              same-city courier (we&apos;ll use your phone GPS), or keep{" "}
              <span className="font-semibold">Standard shipping</span>. Quick
              rates come from Shiprocket and are included in your order total.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col sm:flex-row justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-5 py-2 rounded-xl font-semibold border border-gray-300 text-gray-700"
          >
            Use Standard
          </button>
          <button
            onClick={() => {
              handleClose();
              if (typeof onChooseQuick === "function") onChooseQuick();
            }}
            className="px-5 py-2 rounded-xl text-white font-semibold border-2 shadow-soft"
            style={{
              backgroundColor: "rgb(238, 34, 37)",
              borderColor: "rgb(200, 20, 22)",
            }}
          >
            Choose Quick
          </button>
        </div>
      </div>
    </div>
  );
}
