import React, { useState } from "react";
import { useCart } from "../context/CartContext";
import { toast } from "react-toastify";
import { FaPlus, FaMinus } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";

const AddToCartButton = ({ item, small = false }) => {
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const { addToCart, loading } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (selectedQuantity < 1) return;
    
    // Pass the full item object so guest (localStorage) flow can save name/price/image
    const success = await addToCart(item, selectedQuantity);
    console.log(success,"ddddddd");
    
    if (!success) {
      toast.error("Failed to add to cart");
      return;
    }
    toast.success(`Added ${selectedQuantity} item(s) to cart`);
    setSelectedQuantity(1);
  };

  const handleIncrease = (e) => {
    e.stopPropagation();
    setSelectedQuantity((prev) => prev + 1);
  };

  const handleDecrease = (e) => {
    e.stopPropagation();
    if (selectedQuantity > 1) {
      setSelectedQuantity((prev) => prev - 1);
    }
  };

  return (
    <div
      className="flex items-center gap-2 w-full justify-between"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Quantity Controls - Left side */}
      <div
        className={`flex items-center gap-1 bg-neutral-100 border-2 border-neutral-300 rounded-lg ${
          small ? "p-0.5" : "p-1"
        }`}
      >
        <button
          onClick={handleDecrease}
          disabled={selectedQuantity <= 1}
          className={`${
            small ? "w-6 h-6" : "w-7 h-7"
          } text-white rounded border-2 flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          style={{
            backgroundColor: "rgb(238, 34, 37)",
            borderColor: "rgb(200, 20, 22)",
          }}
        >
          <FaMinus className={small ? "text-xs" : "text-sm"} />
        </button>
        <span
          className={`${
            small ? "w-7 text-xs" : "w-8 text-sm"
          } text-center font-bold text-neutral-900`}
        >
          {selectedQuantity}
        </span>
        <button
          onClick={handleIncrease}
          disabled={false}
          className={`${
            small ? "w-6 h-6" : "w-7 h-7"
          } text-white rounded border-2 flex items-center justify-center active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          style={{
            backgroundColor: "rgb(238, 34, 37)",
            borderColor: "rgb(200, 20, 22)",
          }}
        >
          <FaPlus className={small ? "text-xs" : "text-sm"} />
        </button>
      </div>

      {/* Add to Cart Button - Right side */}
      <button
        onClick={handleAddToCart}
        disabled={loading}
        className={`${
          small ? "w-16 h-8 text-xs" : "w-20 h-9 text-sm"
        } text-white rounded-lg flex items-center justify-center gap-1 shadow-sm hover:shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex-shrink-0`}
        style={{
          backgroundColor: "rgb(238, 34, 37)",
          border: "2px solid rgb(200, 20, 22)",
        }}
        title="Add to cart"
        aria-label="Add to cart"
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <span>Add</span>
        )}
      </button>
    </div>
  );
};

export default AddToCartButton;
