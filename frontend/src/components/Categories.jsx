import React, { useEffect, useState } from "react";
import { getCategories } from "../api/products";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import useProducts from "../hooks/useProducts";
import AddToCartButton from "./AddToCartButton";
import Footer from "./Footer";

const defaultPills = [
  "All",
  "Savory",
  "Namkeen",
  "Sweet",
  "Travel Pack Combo",
  "Value Pack Offers",
  "Gift Packs",
];

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPill, setSelectedPill] = useState("All");
  const [sort, setSort] = useState("default");
  const [imageIndices, setImageIndices] = useState({});
  const [variantIndexByItem, setVariantIndexByItem] = useState({});
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { products: items, loading: itemsLoading } = useProducts({ limit: 200 });
  const loading = catsLoading || itemsLoading;

  useEffect(() => {
    const qCat = searchParams.get("category");
    const qSearch = searchParams.get("search");
    console.log("Category from URL:", qCat); // Debug log
    console.log("Search from URL:", qSearch); // Debug log
    if (qCat) setSelectedPill(qCat);
    if (qSearch) setSearch(qSearch);
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      setCatsLoading(true);
      try {
        const catRes = await getCategories();
        if (catRes.data.success) setCategories(catRes.data.categories || []);
      } catch (err) {
        console.error(err);
      } finally {
        setCatsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!items?.length) return;
    const uniqueCategories = [
      ...new Set(items.map((item) => item.category)),
    ];
    console.log("Available categories in items:", uniqueCategories);
  }, [items]);

  const filtered = (items || []).filter((it) => {
    if (selectedPill && selectedPill !== "All") {
      // match category roughly
      if (!it.category) return false;
      console.log(
        "Checking item:",
        it.name,
        "category:",
        it.category,
        "selectedPill:",
        selectedPill
      ); // Debug log
      if (!it.category.toLowerCase().includes(selectedPill.toLowerCase()))
        return false;
    }
    if (search) {
      return (it.name || "").toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const sorted = [...filtered];
  if (sort === "low") sorted.sort((a, b) => a.price - b.price);
  if (sort === "high") sorted.sort((a, b) => b.price - a.price);

  return (
    <div
      className="min-h-screen flex flex-col pb-24 pt-32"
      style={{ backgroundColor: "#FFF5F5" }}
    >
      <div className="w-full px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 via-orange-600 to-amber-600 bg-clip-text text-transparent animate-pulse-glow">
              🛍️ Browse Categories 🛍️
            </h1>
            <p className="text-sm text-neutral-600 font-medium mt-1">
              Discover our wide range of delicious products
            </p>
          </div>

          <div className="w-56">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full rounded-xl border-2 border-neutral-300 p-3 bg-white shadow-soft focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm hover:border-primary-400"
            >
              <option value="default">Default Sorting</option>
              <option value="low">Price: Low to High</option>
              <option value="high">Price: High to Low</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-neutral-600">
            Showing{" "}
            <span className="font-semibold text-neutral-900">
              {sorted.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-neutral-900">
              {items.length}
            </span>{" "}
            products
          </span>
        </div>
        

        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {defaultPills.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setSelectedPill(p);
                }}
                className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all active:scale-95 ${
                  selectedPill === p
                    ? "bg-primary-600 border-primary-600 text-white shadow-soft"
                    : "bg-white border-neutral-300 text-neutral-700 hover:border-primary-300 hover:bg-primary-50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
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
              <p className="text-neutral-600">Loading products...</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="col-span-full text-center p-12 bg-white rounded-2xl shadow-card">
              <p className="text-neutral-600 text-lg">No products found</p>
              <p className="text-neutral-500 text-sm mt-2">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            sorted.map((item) => {
              const productId = item?._id || item?.id;
              const itemKey = productId || item?.slug || item?.name || Math.random().toString(36).slice(2);
              const hasVariants = Array.isArray(item?.variants) && item.variants.length > 0;
              const selIndex = hasVariants ? (variantIndexByItem[itemKey] ?? 0) : 0;
              const selectedVariant = hasVariants ? item.variants[Math.max(0, Math.min(selIndex, item.variants.length - 1))] : null;
              const displayPrice = hasVariants ? Number(selectedVariant?.price || 0) : Number(item.price || 0);
              const displayUnit = hasVariants ? String(selectedVariant?.label || "") : (item.unit || "");

              return (
              <div
                key={itemKey}
                className="group relative bg-white/90 backdrop-blur-sm rounded-3xl border-[3px] border-neutral-300 overflow-hidden hover:shadow-2xl hover:border-primary-400 hover:-translate-y-1 transition-all duration-500 cursor-pointer"
                onClick={() =>
                  productId && navigate(`/product/${productId}`, { state: { product: item } })
                }
              >
                {/* Discount Badge */}
                {item.discount > 0 && (
                  <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-md z-10">
                    {item.discount}% OFF
                  </span>
                )}

                {/* Image Container with gradient background and carousel */}
                <div className="relative w-full h-52 bg-gradient-to-br from-peach-50 via-white to-warm-100 overflow-hidden group/carousel p-3">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,245,235,0.8),transparent)]" />
                  {(() => {
                    const images = [];
                    if (item.imageUrl) images.push(item.imageUrl);
                    if (Array.isArray(item.images)) images.push(...item.images);
                    const uniqueImages = [...new Set(images)].filter(Boolean);
                    const currentIndex =
                      imageIndices[item._id] ??
                      (uniqueImages.length > 1 ? 1 : 0);
                    const displayImage =
                      uniqueImages[currentIndex] || "/placeholder.svg";

                    return (
                      <>
                        <img
                          src={displayImage}
                          alt={item.name}
                          className="relative w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
                        />
                        {uniqueImages.length > 1 && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setImageIndices((prev) => ({
                                  ...prev,
                                  [item._id]:
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
                                  [item._id]:
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
                    {item.name}
                  </h3>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-primary-600 tracking-tight">
                          ₹{Number(displayPrice).toFixed(3)}
                        </span>
                        <span className="text-lg text-neutral-500 font-medium">
                          {displayUnit ? `/${displayUnit}` : ""}
                        </span>
                      </div>
                      {item.discount > 0 && item.price && (
                        <span className="text-xs text-neutral-400 line-through font-medium">
                          ₹
                          {Number(
                            item.price / (1 - item.discount / 100)
                          ).toFixed(3)}
                        </span>
                      )}
                    </div>
                    {hasVariants && (
                      <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={selIndex}
                          onChange={(e) => {
                            const idx = Number(e.target.value) || 0;
                            setVariantIndexByItem((prev) => ({ ...prev, [itemKey]: idx }));
                          }}
                          className="w-full border-2 border-red-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                          {item.variants.map((v, idx) => (
                            <option key={idx} value={idx}>
                              {String(v.label)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="w-full"
                    >
                      <AddToCartButton
                        item={
                          hasVariants
                            ? { ...item, price: displayPrice, unit: displayUnit, selectedVariant: selectedVariant?.label, maxQty: Number(selectedVariant?.quantity || 0) }
                            : { ...item, maxQty: Number(item?.quantity || 0) }
                        }
                        small
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
            })
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Categories;
