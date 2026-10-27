import React from "react";
import { FaTimes } from "react-icons/fa";

export default function AddressFormModal({
  open,
  mode = "add",
  form,
  setForm,
  onClose,
  onSubmit,
}) {
  if (!open) return null;
  const title = mode === "edit" ? "Edit Address" : "Add New Address";
  const submitLabel = mode === "edit" ? "Update Address" : "Add Address";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <FaTimes className="text-gray-500" />
          </button>
        </div>
        <div className="space-y-4">
          <select
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          >
            <option value="">Select Address Title</option>
            <option value="Home">Home</option>
            <option value="Office">Office</option>
            <option value="Other">Other</option>
          </select>
          <input
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Full Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Phone Number *"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
          <textarea
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            placeholder="Complete Address *"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows="3"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="City *"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
            <input
              className="p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="State *"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              required
            />
          </div>
          <input
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Pincode *"
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            required
          />

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) =>
                setForm({ ...form, isDefault: e.target.checked })
              }
              className="w-4 h-4 text-red-600 focus:ring-red-500 rounded"
            />
            <span className="text-sm text-gray-600">Set as default address</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="px-6 py-2 rounded-xl text-white font-semibold transition-all active:scale-95 shadow-soft border-2"
            style={{
              backgroundColor: "rgb(238, 34, 37)",
              borderColor: "rgb(200, 20, 22)",
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
