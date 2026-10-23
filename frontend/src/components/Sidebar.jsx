import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaTimes, FaChevronDown, FaChevronUp } from "react-icons/fa";
import { apiGet } from "../utils/axiosInstance";

// Import category images
import savoryImg from "../assets/savory.png";
import namkeenImg from "../assets/namkeen.png";
import sweetImg from "../assets/Sweet.jpg";
import travelPackImg from "../assets/travelpackcombo.png";
import valuePackImg from "../assets/valuepackoffers.png";
import giftPacksImg from "../assets/giftpacks.png";

const categories = [
  { name: "Savory", img: savoryImg, bg: "bg-orange-100" },
  { name: "Namkeen", img: namkeenImg, bg: "bg-yellow-100" },
  { name: "Sweet", img: sweetImg, bg: "bg-pink-100" },
  { name: "Travel Pack Combo", img: travelPackImg, bg: "bg-green-100" },
  { name: "Value Pack Offers", img: valuePackImg, bg: "bg-teal-100" },
  { name: "Gift Packs", img: giftPacksImg, bg: "bg-purple-100" },
];

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [categoryItems, setCategoryItems] = useState({});
  const [loading, setLoading] = useState(false);

  // Fetch items for a category
  const fetchCategoryItems = async (categoryName) => {
    if (categoryItems[categoryName]) return; // Already fetched

    setLoading(true);
    try {
      const res = await apiGet("/api/admin-items?limit=200");
      if (res.data.success) {
        const allItems = res.data.items || [];
        // Filter items by category (case-insensitive partial match)
        const filteredItems = allItems.filter(
          (item) =>
            item.category &&
            item.category.toLowerCase().includes(categoryName.toLowerCase())
        );

        setCategoryItems((prev) => ({
          ...prev,
          [categoryName]: filteredItems.slice(0, 3), // Get first 3 items
        }));
      }
    } catch (error) {
      console.error("Error fetching category items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (categoryName) => {
    if (expandedCategory === categoryName) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(categoryName);
      fetchCategoryItems(categoryName);
    }
  };

  const handleViewMore = (categoryName) => {
    onClose();
    navigate(`/categories?category=${encodeURIComponent(categoryName)}`);
  };

  const handleItemClick = (item) => {
    onClose();
    navigate(`/product/${item._id}`, { state: { product: item } });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-80 bg-peach-50 shadow-float z-[70] overflow-y-auto animate-slide-in-left">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-warm-200 bg-gradient-to-r from-primary-50 to-peach-100">
          <h2 className="text-2xl font-bold text-neutral-900">Categories</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/80 transition-all active:scale-95"
            aria-label="Close"
          >
            <FaTimes className="text-neutral-600 text-xl" />
          </button>
        </div>

        {/* Categories List */}
        <div className="p-4 space-y-3">
          {categories.map((category) => (
            <div key={category.name} className="border border-neutral-200 rounded-xl overflow-hidden hover:border-primary-300 transition-colors">
              {/* Category Header */}
              <button
                onClick={() => handleCategoryClick(category.name)}
                className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-all active:bg-neutral-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${category.bg} shadow-soft`}
                  >
                    <img
                      src={category.img}
                      alt={category.name}
                      className="w-7 h-7 object-contain"
                    />
                  </div>
                  <span className="font-semibold text-neutral-800">
                    {category.name}
                  </span>
                </div>
                <div className={`transition-transform duration-200 ${
                  expandedCategory === category.name ? "rotate-180" : ""
                }`}>
                  <FaChevronDown className="text-neutral-400" />
                </div>
              </button>

              {/* Dropdown Items */}
              {expandedCategory === category.name && (
                <div className="border-t border-neutral-200 bg-neutral-50/50 p-3 space-y-2 animate-fade-in">
                  {loading ? (
                    <div className="text-neutral-500 text-sm py-3 text-center">
                      <svg className="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  ) : categoryItems[category.name]?.length > 0 ? (
                    <>
                      {categoryItems[category.name].map((item) => (
                        <button
                          key={item._id}
                          onClick={() => handleItemClick(item)}
                          className="w-full text-left p-3 rounded-lg hover:bg-white hover:shadow-soft transition-all active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-soft">
                              <img
                                src={item.imageUrl || "/placeholder.svg"}
                                alt={item.name}
                                className="w-8 h-8 object-contain"
                              />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-neutral-800 line-clamp-1">
                                {item.name}
                              </div>
                              <div className="text-sm text-primary-600 font-medium">
                                ₹{Number(item.price).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}

                      {/* View More Button */}
                      <button
                        onClick={() => handleViewMore(category.name)}
                        className="w-full text-center p-3 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg transition-all text-sm font-semibold active:scale-[0.98]"
                      >
                        View All {category.name} →
                      </button>
                    </>
                  ) : (
                    <div className="text-neutral-500 text-sm py-3 text-center">
                      No items found
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
