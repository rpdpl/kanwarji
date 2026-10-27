import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getAddresses } from "../../api/addresses";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";

export default function useCheckoutData() {
  const navigate = useNavigate();
  const { cart, fetchCart, updateQty, removeItem, clearCart } = useCart();
  const { loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAddresses = useCallback(async () => {
    const addrRes = await getAddresses();
    if (addrRes.data.success) {
      const list = addrRes.data.addresses || [];
      setAddresses(list);
      const preferred =
        list.find((a) => a.isDefault) || list[0] || null;
      setSelectedAddressId((prev) => {
        if (
          prev &&
          list.some((a) => String(a._id) === String(prev))
        ) {
          return prev;
        }
        return preferred?._id ?? null;
      });
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (!localStorage.getItem("token")) {
        throw new Error("Please login to checkout");
      }
      await fetchCart();
      await loadAddresses();
    } catch (err) {
      console.error(err);
      toast.error("Please login to checkout");
      navigate("/login");
    } finally {
      setLoading(false);
    }
  }, [fetchCart, loadAddresses, navigate]);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading, loadData]);

  useEffect(() => {
    const handler = () => {
      fetchCart();
      loadAddresses();
    };
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, [fetchCart, loadAddresses]);

  return {
    cart,
    addresses,
    setAddresses,
    selectedAddressId,
    setSelectedAddressId,
    loading: loading || authLoading,
    loadData,
    loadAddresses,
    updateQty,
    removeItem,
    clearCart,
    fetchCart,
  };
}
