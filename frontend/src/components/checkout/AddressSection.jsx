import React from "react";
import { FaMapMarkerAlt, FaEllipsisV, FaEdit, FaTrash } from "react-icons/fa";

export default function AddressSection({
  addresses,
  selectedAddressId,
  setSelectedAddressId,
  showMenuFor,
  setShowMenuFor,
  openAddModal,
  openEditModal,
  handleDeleteAddress,
}) {
  return (
    <div className="mt-4 bg-white rounded-xl shadow p-4 border border-[#ffecec] relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FaMapMarkerAlt className="text-red-500" />
          <div className="font-semibold">Delivery Address</div>
        </div>
        {addresses.length > 0 && (
          <button
            onClick={openAddModal}
            className="text-red-600 text-sm font-medium hover:bg-red-50 px-3 py-1 rounded"
          >
            Add New
          </button>
        )}
      </div>

      <div className="space-y-3">
        {(addresses || []).length === 0 && (
          <div className="p-6 rounded-lg border border-dashed border-gray-200 text-center">
            <FaMapMarkerAlt className="text-gray-300 text-2xl mx-auto mb-3" />
            <div className="text-sm text-gray-500 mb-4">
              No saved addresses found
            </div>
            <button
              onClick={openAddModal}
              className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-2 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all active:scale-95 shadow-soft"
            >
              Add Delivery Address
            </button>
          </div>
        )}

        {(addresses || []).map((addr) => (
          <div
            key={addr._id}
            className={`p-4 rounded-lg border relative transition-all ${
              addr._id === selectedAddressId
                ? "border-red-300 bg-red-50 shadow-md"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <div className="absolute right-3 top-3">
              <button
                onClick={() =>
                  setShowMenuFor(showMenuFor === addr._id ? null : addr._id)
                }
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="address menu"
              >
                <FaEllipsisV className="text-gray-400" />
              </button>
              {showMenuFor === addr._id && (
                <div className="absolute right-0 top-10 w-40 bg-white rounded-lg shadow-lg border py-2 z-10">
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left text-sm"
                    onClick={() => openEditModal(addr)}
                  >
                    <FaEdit className="text-blue-500" />
                    Edit
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-gray-50 text-left text-sm"
                    onClick={() => handleDeleteAddress(addr._id)}
                  >
                    <FaTrash className="text-red-500" />
                    Delete
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-start justify-between pr-10">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-xs font-medium">
                    {addr.title || "Home"}
                  </span>
                  {addr.isDefault && (
                    <span className="bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs">
                      Default
                    </span>
                  )}
                </div>
                <div className="font-semibold text-gray-800 mb-1">
                  {addr.name}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {addr.address}
                  {addr.city && `, ${addr.city}`}
                  {addr.state && `, ${addr.state}`} - {addr.pincode}
                </div>
                <div className="text-sm text-gray-500">📞 {addr.phone}</div>
              </div>
              <div className="flex-shrink-0">
                <input
                  type="radio"
                  name="deliveryAddress"
                  checked={addr._id === selectedAddressId}
                  onChange={() => setSelectedAddressId(addr._id)}
                  className="w-4 h-4 text-red-600 focus:ring-red-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
