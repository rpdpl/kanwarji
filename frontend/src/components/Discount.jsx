import { useSEO } from "../utils/Seo";
import React, { useEffect, useState, useRef } from "react";
import Footer from "./Footer";
import { apiGet } from "../utils/axiosInstance";
import { useNavigate } from "react-router-dom";
import AddToCartButton from "./AddToCartButton";
import { useProductCache } from "../context/ProductCacheContext";

const Discount = () => {
  useSEO({
    title:
      "Kanwarji Dalbijiwala - Authentic Indian Sweets & Namkeen Since 175 Years",
    description:
      "Kanwarji offers authentic Indian sweets, namkeen, and chats crafted with 175 years of tradition, quality, and trust. Taste true Indian flavors at Kanwarji.in.",
    canonical: "https://kanwarji.in/discount",
  });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageIndices, setImageIndices] = useState({});
  const [visibleCount, setVisibleCount] = useState(8);
  const loadMoreRef = useRef(null);
  const navigate = useNavigate();
  const { putMany } = useProductCache();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiGet("/api/admin-products/with-discount");
        if (res.data.success) {
          setProducts(res.data.products || []);
          putMany(res.data.products || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Intersection observer to lazy-show more items
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleCount((v) => Math.min(products.length, v + 8));
          }
        });
      },
      { root: null, rootMargin: "200px", threshold: 0.1 }
    );
    obs.observe(loadMoreRef.current);
    return () => obs.disconnect();
  }, [products.length]);

  const formatPrice = (v) => `₹${Number(v).toFixed(3)}`;

  return (
    <div
      className="min-h-screen flex flex-col pb-32 pt-32"
      style={{ backgroundColor: "#FFF5F5" }}
    >
      <div className="w-full px-4">
        <div className="mb-6 animate-slide-up">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 bg-clip-text text-transparent animate-pulse-glow mb-2">
            🎉 Special Discounts of the day 🎉
          </h1>
          <p className="text-neutral-600 font-medium text-base">
            Grab the best deals on your favorite products - Limited time offers!
          </p>
        </div>
        

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {loading ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16">
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
              <p className="text-neutral-600">Loading deals...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="col-span-full text-center p-12 bg-white rounded-2xl shadow-card">
              <p className="text-neutral-600 text-lg">
                No discounted products available
              </p>
              <p className="text-neutral-500 text-sm mt-2">
                Check back later for great deals!
              </p>
            </div>
          ) : (
            products.slice(0, visibleCount).map((p) => {
              const discount = p.discount || 0;
              const price = Number(p.price || 0);
              const oldPrice =
                discount > 0 ? price / (1 - discount / 100) : null;
              const pack =
                p.quantity && p.unit ? `${p.quantity} ${p.unit}` : p.unit || "";
              const img =
                p.imageUrl ||
                (Array.isArray(p.images) && p.images[0]) ||
                "/placeholder.svg";
              return (
                <div
                  key={p._id}
                  className="group relative bg-white/90 backdrop-blur-sm rounded-3xl border-[3px] border-neutral-300 overflow-hidden hover:shadow-2xl hover:border-primary-400 hover:-translate-y-1 transition-all duration-500 cursor-pointer"
                  onClick={() =>
                    navigate(`/product/${p._id}`, { state: { product: p } })
                  }
                >
                  {/* discount badge */}
                  {discount > 0 && (
                    <div className="absolute top-2 left-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-soft animate-scale-pulse">
                      🔥 {discount}% OFF
                    </div>
                  )}

                  {/* Image Container with gradient background and carousel */}
                  <div className="relative w-full h-52 bg-gradient-to-br from-peach-50 via-white to-warm-100 overflow-hidden group/carousel p-3">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,245,235,0.8),transparent)]" />
                    {(() => {
                      const images = [];
                      if (p.imageUrl) images.push(p.imageUrl);
                      if (Array.isArray(p.images)) images.push(...p.images);
                      const uniqueImages = [...new Set(images)].filter(Boolean);
                      const currentIndex =
                        imageIndices[p._id] ??
                        (uniqueImages.length > 1 ? 1 : 0);
                      const displayImage = uniqueImages[currentIndex] || img;

                      return (
                        <>
                          <img
                            src={displayImage}
                            alt={p.name}
                            className="relative w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
                          />
                          {uniqueImages.length > 1 && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setImageIndices((prev) => ({
                                    ...prev,
                                    [p._id]:
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
                                  setImageIndices((prev) => ({
                                    ...prev,
                                    [p._id]:
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
                              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                                {uniqueImages.map((_, idx) => (
                                  <div
                                    key={idx}
                                    className={`h-1 rounded-full transition-all ${
                                      idx === currentIndex
                                        ? "w-4 bg-primary-500"
                                        : "w-1 bg-white/60"
                                    }`}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary-100/30 to-transparent rounded-bl-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>

                  {/* Content */}
                  <div className="relative p-4 bg-gradient-to-b from-white to-peach-50 border-t-[3px] border-neutral-300">
                    <h3 className="font-bold text-base text-neutral-800 line-clamp-2 leading-snug mb-0 min-h-[3rem] group-hover:text-primary-600 transition-colors text-center">
                      {p.name}
                    </h3>
                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-primary-600 tracking-tight">
                            {formatPrice(price)}
                          </span>
                          <span className="text-lg text-neutral-500 font-medium">
                            /kg
                          </span>
                        </div>
                        {oldPrice && (
                          <span className="text-xs text-neutral-400 line-through font-medium">
                            {formatPrice(oldPrice)}
                          </span>
                        )}
                      </div>
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full"
                      >
                        <AddToCartButton item={p} small />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* sentinel for lazy loading more */}
        <div ref={loadMoreRef} className="h-6"></div>
      </div>
      <Footer />
    </div>
  );
};

export default Discount;
