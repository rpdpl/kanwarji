import { useState } from "react";
import { toast } from "react-toastify";
import {
  createAddress,
  updateAddress,
  deleteAddress,
} from "../../api/addresses";
import { emptyAddr, validateAddressForm } from "./utils";

export default function useCheckoutAddresses({
  loadData,
  selectedAddressId,
  setSelectedAddressId,
}) {
  const [showMenuFor, setShowMenuFor] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [editForm, setEditForm] = useState(emptyAddr);
  const [addForm, setAddForm] = useState(emptyAddr);

  const handleDeleteAddress = async (id) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      const res = await deleteAddress(id);
      if (res.data.success) {
        toast.success(res.data.message || "Address deleted successfully");
        setShowMenuFor(null);
        await loadData();
      } else {
        toast.error(
          res?.data?.message || res?.data?.error || "Failed to delete address"
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to delete address"
      );
    }
  };

  const openEditModal = (addr) => {
    setEditingAddress(addr);
    setEditForm({
      title: addr.title || "",
      name: addr.name || "",
      phone: addr.phone || "",
      address: addr.address || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode || "",
      isDefault: !!addr.isDefault,
      preferredShippingMode:
        addr.preferredShippingMode === "quick" ? "quick" : "standard",
    });
    setShowMenuFor(null);
    setShowEditModal(true);
  };

  const handleUpdateAddress = async () => {
    if (!editingAddress) return;
    const result = validateAddressForm(editForm);
    if (!result.ok) return toast.error(result.error);
    try {
      const res = await updateAddress(editingAddress._id, result.normalized);
      if (res.data.success) {
        toast.success(res.data.message || "Address updated");
        setShowEditModal(false);
        setEditingAddress(null);
        await loadData();
        if (editingAddress._id === selectedAddressId) {
          setSelectedAddressId(null);
          setTimeout(() => setSelectedAddressId(editingAddress._id), 0);
        }
      } else {
        toast.error(
          res?.data?.message || res?.data?.error || "Failed to update address"
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to update address"
      );
    }
  };

  const openAddModal = () => {
    setAddForm(emptyAddr);
    setShowAddModal(true);
  };

  const handleAddAddress = async () => {
    const result = validateAddressForm(addForm);
    if (!result.ok) return toast.error(result.error);
    try {
      const res = await createAddress(result.normalized);
      if (res.data.success) {
        toast.success(res.data.message || "Address added");
        setShowAddModal(false);
        await loadData();
        const newId = res.data?.address?._id || res.data?.addressId;
        if (newId) {
          setSelectedAddressId(null);
          setTimeout(() => setSelectedAddressId(newId), 0);
        } else {
          const prev = selectedAddressId;
          setSelectedAddressId(null);
          setTimeout(() => setSelectedAddressId(prev), 0);
        }
      } else {
        toast.error(
          res?.data?.message || res?.data?.error || "Failed to add address"
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to add address"
      );
    }
  };

  return {
    showMenuFor,
    setShowMenuFor,
    showEditModal,
    setShowEditModal,
    showAddModal,
    setShowAddModal,
    editingAddress,
    editForm,
    setEditForm,
    addForm,
    setAddForm,
    handleDeleteAddress,
    openEditModal,
    handleUpdateAddress,
    openAddModal,
    handleAddAddress,
  };
}
