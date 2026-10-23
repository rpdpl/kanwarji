import React from "react";
import { FaCreditCard } from "react-icons/fa";

export default function PaymentMethodCard() {
  return (
    <div className="mt-4 bg-white rounded-xl shadow p-4 border border-[#ffecec]">
      <div className="font-semibold flex items-center gap-2 mb-4">
        <FaCreditCard className="text-red-500" />
        Payment Method
      </div>
      <div className="space-y-3">
        <div className="block p-4 rounded-lg border border-blue-400 bg-blue-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-blue-500 text-xl">💳</div>
              <div>
                <div className="font-semibold">Online Payment</div>
                <div className="text-sm text-gray-500">
                  Pay securely with Instamojo
                </div>
              </div>
            </div>
            <div className="bg-blue-500 text-white text-xs px-3 py-1.5 rounded font-medium">
              Instamojo
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
