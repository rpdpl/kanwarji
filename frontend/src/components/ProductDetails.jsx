import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { apiGet } from "../utils/axiosInstance";
import { useCart } from "../context/CartContext";
import { toast } from "react-toastify";
import { HiOutlineCheckCircle } from "react-icons/hi";
import { FiChevronRight, FiMinus, FiPlus } from "react-icons/fi";
import { AiOutlineShoppingCart } from "react-icons/ai";
import AddToCartButton from "./AddToCartButton";
import { useProductCache } from "../context/ProductCacheContext";
import BottomNav from "./BottomNav";

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getOne, putOne, putMany } = useProductCache();
  const [item, setItem] = useState(null); // current product
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [qty, setQty] = useState(1);
  const [related, setRelated] = useState([]); // related items list
  const [allProducts, setAllProducts] = useState([]); // all products for display
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [relatedImageIndices, setRelatedImageIndices] = useState({}); // for related products carousel
  const { addToCart } = useCart();
  const [variantIndex, setVariantIndex] = useState(0);

  const fetchProductData = useCallback(
    async (productId) => {
      setLoading(true);
      setError(null);
      try {
        // route state
        const routeProduct = location.state?.product;
        if (
          routeProduct &&
          (routeProduct._id || routeProduct.id) === productId
        ) {
          setItem(routeProduct);
          putOne(routeProduct);
        }
        // cache
        if (!routeProduct) {
          const cached = getOne(productId);
          if (cached) setItem(cached);
        }
        let found = routeProduct || getOne(productId) || null;
        // one bulk fetch if needed
        if (!found) {
          const res = await apiGet("/api/admin-items?limit=500&status=all");
          if (res.data?.success && Array.isArray(res.data.items)) {
            putMany(res.data.items);
            setAllProducts(res.data.items); // Set all products for display
            found = res.data.items.find(
              (it) => it._id === productId || it.id === productId
            );
            if (found) {
              const rel = res.data.items.filter(
                (it) => (it._id || it.id) !== (found._id || found.id)
              );
              setRelated(rel.slice(0, 12));
            }
          }
        } else {
          // async related and all products
          apiGet("/api/admin-items?limit=500&status=available")
            .then((res) => {
              if (!res.data?.success || !Array.isArray(res.data.items)) return;
              putMany(res.data.items);
              setAllProducts(res.data.items); // Set all products for display
              const rel = res.data.items.filter(
                (it) => (it._id || it.id) !== (found._id || found.id)
              );
              setRelated(rel.slice(0, 12));
            })
            .catch(() => {});
        }
        if (!found) {
          setError("Product not found");
          setItem(null);
        } else {
          setItem(found);
          putOne(found);
        }
      } catch (e) {
        setError(e.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    },
    [getOne, location.state, putMany, putOne]
  );

  useEffect(() => {
    if (id) {
      // Reset all states first when product changes
      setItem(null);
      setLoading(true);
      setError(null);
      setQty(1);
      setCurrentImageIndex(0);
      setAllProducts([]);
      setRelated([]);

      // Then fetch new product data
      fetchProductData(id);
    }
  }, [id, fetchProductData]);

  // Debug quantity changes
  useEffect(() => {
    console.log("Qty state changed to:", qty, "for item:", item?.name);
  }, [qty, item?.name]);

  // derived (no hooks)
  const hasVariants = Array.isArray(item?.variants) && item.variants.length > 0;
  const selectedVariant = hasVariants
    ? item.variants[Math.max(0, Math.min(variantIndex, item.variants.length - 1))]
    : null;
  const discount = item?.discount || 0;
  const currentPrice = hasVariants
    ? Number(selectedVariant?.price || 0)
    : Number(item?.price || 0);
  const taxPercent = Number(item?.tax || 0);
  const taxPerUnit = taxPercent > 0 ? currentPrice * (taxPercent / 100) : 0;
  const oldPrice = discount > 0 ? currentPrice / (1 - discount / 100) : null;
  const maxQty = hasVariants ? Number(selectedVariant?.quantity || 0) : Number(item?.quantity || 0);
  const productImages = item
    ? (Array.isArray(item.images) && item.images.length > 0
        ? item.images
        : [item.imageUrl]
      ).filter(Boolean)
    : ["/placeholder.svg"];

  useEffect(() => {
    if (productImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentImageIndex((i) => (i + 1) % productImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [productImages.length]);

  // When variant changes, reset qty and clamp to the selected variant's stock
  useEffect(() => {
    const limit = maxQty && maxQty > 0 ? maxQty : 99;
    setQty((q) => Math.min(limit, 1));
  }, [variantIndex, maxQty]);

  const handleAddToCart = async () => {
    if (!item) return;
    try {
      const enriched = hasVariants
        ? { ...item, price: currentPrice, unit: String(selectedVariant?.label || item.unit || ""), selectedVariant: String(selectedVariant?.label || ""), maxQty: Number(selectedVariant?.quantity || 0) }
        : { ...item, maxQty: Number(item?.quantity || 0) };
      await addToCart(enriched, qty);
      toast.success("Item added to your cart");
      setQty(1); // Reset quantity after add
    } catch (err) {
      try {
        sessionStorage.setItem("redirectAfterLogin", location.pathname);
      } catch (_) {}
      toast.info("Please login to add items to cart");
      navigate("/login");
    }
  };

  // early return UI
  if (loading)
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#FFF5F5" }}
      >
        <div className="flex flex-col items-center">
          <svg
            className="animate-spin h-10 w-10 text-primary-600 mb-4"
            viewBox="0 0 24 24"
          >
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
          <p className="text-neutral-600">Loading product...</p>
        </div>
      </div>
    );
  if (error)
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center"
        style={{ backgroundColor: "#FFF5F5" }}
      >
        <div className="w-20 h-20 bg-danger-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-10 h-10 text-danger-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-neutral-900 font-semibold text-lg mb-2">
          Oops! Something went wrong
        </p>
        <p className="text-neutral-600 mb-6">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => fetchProductData(id)}
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold shadow-soft hover:shadow-card active:scale-95 transition-all"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-semibold hover:bg-neutral-200 active:scale-95 transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  if (!item)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-100 via-peach-200 to-warm-300">
        <div className="text-center">
          <p className="text-neutral-900 font-semibold text-lg mb-2">
            Product not found
          </p>
          <p className="text-neutral-600">
            The product you're looking for doesn't exist
          </p>
        </div>
      </div>
    );

  return (
    <div
      className="min-h-screen pb-24 pt-32"
      style={{ backgroundColor: "#FFF5F5" }}
    >
      {/* Back button - Outside container */}
      <div className="w-full px-4 pb-4 animate-fade-in">
        <button
          onClick={() => navigate(-1)}
          className="bg-white/90 hover:bg-white text-neutral-700 rounded-xl w-10 h-10 flex items-center justify-center shadow-card backdrop-blur-sm transition-all active:scale-95"
          aria-label="Go back"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Product Details Section - Side by Side */}
      <div className="w-full px-4 py-6">
        <div className="grid md:grid-cols-2 gap-8 bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-card animate-slide-up">
          {/* Left: Image Carousel */}
          <div className="relative">
            {discount > 0 && (
              <div className="absolute top-4 left-4 z-20 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-soft animate-scale-pulse">
                🔥 {discount}% OFF
              </div>
            )}
            <div className="relative overflow-hidden bg-gradient-to-br from-peach-50 via-white to-warm-100 rounded-2xl">
              <img
                src={productImages[currentImageIndex]}
                alt={item.name}
                className="w-full h-[500px] object-contain p-8 transition-all duration-500"
              />

              {/* Navigation arrows for manual control */}
              {productImages.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((prev) =>
                        prev === 0 ? productImages.length - 1 : prev - 1
                      )
                    }
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm text-neutral-700 w-10 h-10 rounded-xl flex items-center justify-center shadow-card hover:bg-white transition-all active:scale-95"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex(
                        (prev) => (prev + 1) % productImages.length
                      )
                    }
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm text-neutral-700 w-10 h-10 rounded-xl flex items-center justify-center shadow-card hover:bg-white transition-all active:scale-95"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Image dots indicator */}
            {productImages.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {productImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentImageIndex
                        ? "w-8 bg-primary-600"
                        : "w-2 bg-neutral-300 hover:bg-neutral-400"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Details */}
          <div className="flex flex-col">
            {/* Product Title */}
            <h1 className="text-2xl font-bold text-neutral-900 mb-3">
              {item.name}
            </h1>

            {/* Category Tag */}
            {item.category && (
              <div className="inline-block bg-primary-100 text-primary-700 px-4 py-1.5 rounded-xl text-sm font-semibold mb-4">
                {item.category}
              </div>
            )}

            {/* Price Section */}
            <div className="mb-6">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-3xl font-bold text-primary-600">
                  ₹{currentPrice.toFixed(3)}
                </span>
                <span className="text-neutral-500 text-base">{hasVariants ? (selectedVariant?.label || "") : (item.unit || "")}</span>
              </div>
              {taxPercent > 0 && (
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Tax:</span> {taxPercent}% (₹{taxPerUnit.toFixed(2)} per unit) — added at checkout
                </div>
              )}
              {oldPrice && (
                <div className="flex items-center gap-2">
                  <span className="text-neutral-400 text-lg line-through">
                    ₹{oldPrice.toFixed(3)}
                  </span>
                  <span className="bg-success-100 text-success-700 px-2.5 py-1 rounded-lg text-xs font-bold">
                    {discount}% OFF
                  </span>
                </div>
              )}
            </div>

            {/* Variant Selector */}
            {hasVariants && (
              <div className="mb-6">
                <div className="mb-2 font-medium">Size</div>
                <div className="flex flex-wrap gap-2">
                  {item.variants.map((v, idx) => {
                    const active = idx === (variantIndex || 0);
                    return (
                      <button
                        key={idx}
                        onClick={() => setVariantIndex(idx)}
                        className={`px-3 py-1.5 rounded-md border text-sm transition-all ${
                          active
                            ? "bg-red-500 text-white border-red-600"
                            : "bg-white text-neutral-800 border-red-300 hover:bg-red-50"
                        }`}
                      >
                        {String(v.label)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* In Stock Indicator */}
            <div className="flex items-center gap-2 mb-6 bg-success-50 border-2 border-success-400 px-4 py-2.5 rounded-xl w-fit shadow-sm">
              <HiOutlineCheckCircle className="w-5 h-5 text-success-600" />
              <span className="font-semibold text-success-700">
                In Stock & Ready to Ship
              </span>
            </div>

            {/* Quantity Selector */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-gray-900">Quantity:</span>
                <span className="text-sm text-gray-500">Max: {maxQty || 1}</span>
              </div>
              <div className="flex items-center justify-center border-2 border-gray-400 rounded-lg bg-white max-w-xs mx-auto shadow-sm">
                <button
                  className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-40"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                >
                  <FiMinus className="w-5 h-5" />
                </button>
                <div className="px-8 py-3 text-lg font-medium text-center min-w-[4rem]">
                  {qty}
                </div>
                <button
                  className="p-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors disabled:opacity-40"
                  onClick={() => setQty((q) => {
                    const limit = maxQty && maxQty > 0 ? maxQty : 99;
                    return Math.min(limit, q + 1);
                  })}
                  disabled={maxQty && maxQty > 0 ? qty >= maxQty : false}
                >
                  <FiPlus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleAddToCart}
                className="w-3/4 text-white py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 shadow-soft hover:shadow-card active:scale-[0.98] transition-all border-2"
                style={{
                  backgroundColor: "rgb(238, 34, 37)",
                  borderColor: "rgb(200, 20, 22)",
                }}
              >
                <AiOutlineShoppingCart className="w-6 h-6" />
                Add {qty} {qty > 1 ? "items" : "item"} to Cart
              </button>
            </div>
          </div>

          {/* Expandable Sections */}
          <div className="bg-white mt-4 shadow-soft">
            {/* Product Details */}
            <div className="border-b border-gray-100">
              <details className="group">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-medium text-gray-900">
                    Product Details
                  </span>
                  <FiChevronRight className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-4 pb-4 text-gray-600 text-sm">
                  {item.description ||
                    item.productDetails ||
                    "No product details available."}
                </div>
              </details>
            </div>

            {/* Shipping & Returns */}
            <div className="border-b border-gray-100">
              <details className="group">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-medium text-gray-900">
                    Shipping & Returns
                  </span>
                  <FiChevronRight className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-4 pb-4 text-gray-600 text-sm">
                  <p>• Free shipping on orders above ₹500</p>
                  <p>• Standard delivery: 2-4 business days</p>
                  <p>• Return policy: 7 days from delivery</p>
                  <p>• Items must be in original condition</p>
                </div>
              </details>
            </div>

            {/* May We Help */}
            <div className="border-b border-gray-100">
              <details className="group">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-medium text-gray-900">
                    May We Help?
                  </span>
                  <FiChevronRight className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-4 pb-4 text-gray-600 text-sm">
                  <p>Need assistance? Contact our customer support:</p>
                  <p>📞 Phone: +91-XXXXXXXXXX</p>
                  <p>✉️ Email: support@kanwarjis.com</p>
                  <p>💬 Live Chat: Available 9 AM - 6 PM</p>
                </div>
              </details>
            </div>

            {/* FAQs */}
            <div className="border-b border-gray-100">
              <details className="group">
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-medium text-gray-900">
                    Have A Question? Read Our FAQs
                  </span>
                  <FiChevronRight className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-4 pb-4 text-gray-600 text-sm">
                  <div className="space-y-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        Q: How fresh are the products?
                      </p>
                      <p>
                        A: All our products are made fresh daily with the finest
                        ingredients.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Q: What is the shelf life?
                      </p>
                      <p>
                        A: Most products have a shelf life of 15-30 days when
                        stored properly.
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        Q: Do you offer bulk orders?
                      </p>
                      <p>
                        A: Yes, we offer special pricing for bulk orders.
                        Contact us for details.
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      {/* Shop More For Less Section */}
      <div className="w-full px-4 mt-4">
        {allProducts.length > 0 && (
          <div className="bg-white/60 backdrop-blur-sm mt-2 p-4 rounded-2xl animate-slide-up">
            <div className="flex items-center mb-4">
              <AiOutlineShoppingCart className="w-6 h-6 text-rose-500 mr-2" />
              <h2 className="text-xl font-bold bg-gradient-to-r from-primary-600 via-orange-600 to-amber-600 bg-clip-text text-transparent">
                🛒 Shop More For Less 🛒
              </h2>
            </div>
            <p className="text-neutral-600 text-sm mb-4 font-medium">
              Discover more delicious items you might love
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {allProducts
                .filter(
                  (product) =>
                    (product._id || product.id) !== (item?._id || item?.id)
                )
                .map((relatedItem) => {
                  const relatedDiscount = relatedItem.discount || 0;
                  const relatedCurrentPrice = Number(relatedItem.price || 0);
                  const relatedOldPrice =
                    relatedDiscount > 0
                      ? relatedCurrentPrice / (1 - relatedDiscount / 100)
                      : null;

                  const itemKey = relatedItem._id || relatedItem.id;
                  const images = [];
                  if (relatedItem.imageUrl) images.push(relatedItem.imageUrl);
                  if (Array.isArray(relatedItem.images))
                    images.push(...relatedItem.images);
                  const uniqueImages = [...new Set(images)].filter(Boolean);
                  const currentIndex =
                    relatedImageIndices[itemKey] ??
                    (uniqueImages.length > 1 ? 1 : 0);
                  const displayImage =
                    uniqueImages[currentIndex] || "/placeholder.png";

                  return (
                    <div
                      key={itemKey}
                      className="group relative bg-white/90 backdrop-blur-sm rounded-3xl border-[3px] border-neutral-300 overflow-hidden hover:shadow-2xl hover:border-primary-400 hover:-translate-y-1 transition-all duration-500 cursor-pointer"
                      onClick={() => {
                        const newProductId = relatedItem._id || relatedItem.id;
                        navigate(`/product/${newProductId}`, {
                          state: { product: relatedItem },
                          replace: false,
                        });
                      }}
                    >
                      {relatedDiscount > 0 && (
                        <div className="absolute top-2 left-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-soft animate-scale-pulse">
                          🔥 {Math.round(relatedDiscount)}% OFF
                        </div>
                      )}

                      {/* Image Container with carousel */}
                      <div className="relative w-full h-52 bg-gradient-to-br from-peach-50 via-white to-warm-100 overflow-hidden group/carousel p-3">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,245,235,0.8),transparent)]" />
                        <img
                          src={displayImage}
                          alt={relatedItem.name}
                          className="relative w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        {uniqueImages.length > 1 && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRelatedImageIndices((prev) => ({
                                  ...prev,
                                  [itemKey]:
                                    currentIndex === 0
                                      ? uniqueImages.length - 1
                                      : currentIndex - 1,
                                }));
                              }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10"
                            >
                              <svg
                                className="w-4 h-4 text-neutral-700"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 19l-7-7 7-7"
                                />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRelatedImageIndices((prev) => ({
                                  ...prev,
                                  [itemKey]:
                                    (currentIndex + 1) % uniqueImages.length,
                                }));
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10"
                            >
                              <svg
                                className="w-4 h-4 text-neutral-700"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                            </button>
                            {/* Image indicators */}
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
                              {uniqueImages.map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    idx === currentIndex
                                      ? "bg-primary-600"
                                      : "bg-white/60"
                                  }`}
                                />
                              ))}
                            </div>
                          </>
                        )}
                        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary-100/30 to-transparent rounded-bl-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      </div>

                      {/* Content */}
                      <div className="relative p-4 bg-gradient-to-b from-white to-peach-50 border-t-[3px] border-neutral-300">
                        <h3 className="font-bold text-base text-neutral-800 line-clamp-2 leading-snug mb-0 min-h-[3rem] group-hover:text-primary-600 transition-colors text-center">
                          {relatedItem.name}
                        </h3>
                        <div className="space-y-1">
                          <div className="flex items-baseline justify-between">
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg font-black text-primary-600 tracking-tight">
                                ₹ {relatedCurrentPrice.toFixed(3)}
                              </span>
                              <span className="text-lg text-neutral-500 font-medium">
                               {item.unit || ""}
                              </span>
                            </div>
                            {relatedOldPrice && (
                              <span className="text-xs text-neutral-400 line-through font-medium">
                                ₹ {relatedOldPrice.toFixed(3)}
                              </span>
                            )}
                          </div>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="w-full"
                          >
                            <AddToCartButton item={relatedItem} small />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default ProductDetails;
