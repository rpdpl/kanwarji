import React from "react";
import { FaArrowLeft } from "react-icons/fa";

export default function CheckoutHeader({ onBack }) {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4">
      <div
        className="rounded-2xl shadow-soft px-4 py-3 flex items-center gap-3"
        style={{ backgroundColor: "#EE2225", border: "2px solid #C81416" }}
      >
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-white/10"
        >
          <FaArrowLeft className="text-white" />
        </button>
        <h2 className="text-xl font-bold flex-1 text-center text-white">
          Payment & Delivery
        </h2>
        <div className="w-8"></div>
      </div>
    </div>
  );
}
