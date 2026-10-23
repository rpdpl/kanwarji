import { useSEO } from "../utils/Seo.jsx";

import { useEffect, useState, useRef, useMemo } from "react";
import Footer from "./Footer";
import { apiGet } from "../utils/axiosInstance.jsx";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import AddToCartButton from "./AddToCartButton";

// Import images using Vite's explicit import syntax
import slider1 from "/newslider1.png";
import slider2 from "/newslider2.png";
import slider3 from "/newslider3.png";
import slider4 from "/newslider4.png";
import slider5 from "/newslider5.png";

const sliderImages = [slider1, slider2, slider3, slider4, slider5];

// Debug log to check image paths
console.log("Slider images loaded:", {
  slider1,
  slider2,
  slider3,
  slider4,
  slider5,
});

const HomePage = () => {
  useSEO({
    title:
      "Kanwarji Dalbijiwala - Authentic Indian Sweets & Namkeen Since 175 Years",
    description:
      "Kanwarji Dalbijiwala offers authentic Indian sweets, namkeen, and chats crafted with 175 years of tradition, quality, and trust. Taste true Indian flavors at Kanwarji.in.",
    canonical: "https://kanwarji.in/",
    keywords:
      "buy sweets online, traditional Indian sweets, best sweets in Delhi, Chandni Chowk sweets, Indian mithai online, dry fruits gift pack online, Diwali sweets hamper, wedding sweets box, buy namkeen online, kaju katli online, buy kaju katli online, traditional kaju katli, best kaju katli in Delhi, buy soan papdi online, premium soan papdi, Diwali soan papdi box, dry fruit hamper, festive dry fruit basket, dry fruit gift box online, traditional namkeen online, Chandni Chowk namkeen, spicy Indian namkeen, Indian sweets gift box, corporate gifting sweets, wedding sweet box, authentic Indian sweets online, premium mithai delivery in Delhi, order sweets from Chandni Chowk, online delivery of traditional Indian sweets, send sweets to USA from India, best Diwali sweets under 500, best Diwali sweets under 1000, customized wedding sweets box online, handmade sweets online India, online mithai shop Delhi",
  });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [imageIndices, setImageIndices] = useState({});
  const [variantIndexByItem, setVariantIndexByItem] = useState({});

  const productsRef = useRef(null);
  const { putMany } = useProductCache();
  const navigate = useNavigate();
  // Fetch products from /api/admin-items (GET)
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const res = await apiGet("/api/admin-items?limit=200");
        if (res.data.success && Array.isArray(res.data.items)) {
          setItems(res.data.items);
          putMany(res.data.items);
        }
      } catch (error) {
        // Optionally show toast or error
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  // Slideshow logic
  useEffect(() => {
    const interval = setInterval(() => {
      setSliderIndex((prev) => (prev + 1) % sliderImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price) => `₹ ${Number(price).toFixed(3)}`;

  const DiscountBadge = ({ discount }) =>
    discount ? (
      <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-md z-10">
        {discount}% OFF
      </span>
    ) : null;

  // Best sellers - just products marked as special, no category grouping
  const bestSellerProducts = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return [];

    return items
      .filter((product) => product.isSpecialItem === true)
      .slice(0, 12); // Show up to 12 best sellers
  }, [items]);

  // Shop by Categories - group products by category
  const shopByCategorySections = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return [];

    const categoryBuckets = new Map();

    items.forEach((product) => {
      const category =
        product.category ||
        product.categoryName ||
        (product.categories && product.categories[0]) ||
        "Featured";
      if (!categoryBuckets.has(category)) {
        categoryBuckets.set(category, []);
      }
      categoryBuckets.get(category).push(product);
    });

    return Array.from(categoryBuckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, products]) => ({
        category,
        products: products.slice(0, 4), // Show 4 items per category
      }))
      .filter((section) => section.products.length > 0);
  }, [items]);

  const renderProductCard = (item) => {
    const productId = item?._id || item?.id;
    const itemKey =
      productId ||
      item?.slug ||
      item?.name ||
      Math.random().toString(36).slice(2);

    const hasVariants = Array.isArray(item?.variants) && item.variants.length > 0;
    const selIndex = hasVariants
      ? (variantIndexByItem[itemKey] ?? 0)
      : 0;
    const selectedVariant = hasVariants ? item.variants[Math.max(0, Math.min(selIndex, item.variants.length - 1))] : null;
    const displayPrice = hasVariants ? Number(selectedVariant?.price || 0) : Number(item.price || 0);
    const displayUnit = hasVariants ? String(selectedVariant?.label || "") : (item.unit || "");

    return (
      <div
        key={itemKey}
        className="group relative bg-white/90 backdrop-blur-sm rounded-3xl border-[3px] border-neutral-300 overflow-hidden hover:shadow-2xl hover:border-primary-400 hover:-translate-y-1 transition-all duration-500 cursor-pointer"
        onClick={() =>
          productId &&
          navigate(
            `/product/${productId}`,
            "replaceState" in window.history
              ? { state: { product: item } }
              : { state: { product: item } }
          )
        }
      >
        <DiscountBadge discount={item.discount} />

        {/* Image Container with gradient background and carousel */}
        <div className="relative w-full h-52 bg-gradient-to-br from-peach-50 via-white to-warm-100 overflow-hidden group/carousel p-3">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,245,235,0.8),transparent)]" />
          {(() => {
            const images = [];
            if (item.imageUrl) images.push(item.imageUrl);
            if (Array.isArray(item.images)) images.push(...item.images);
            const uniqueImages = [...new Set(images)].filter(Boolean);
            const currentIndex =
              imageIndices[itemKey] ?? (uniqueImages.length > 1 ? 1 : 0);
            const displayImage =
              uniqueImages[currentIndex] || "/placeholder.png";

            return (
              <>
                <img
                  src={displayImage}
                  alt={item.name}
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
                        setImageIndices((prev) => ({
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
                        setImageIndices((prev) => ({
                          ...prev,
                          [itemKey]: (currentIndex + 1) % uniqueImages.length,
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
                <span
                  className="text-lg font-black tracking-tight"
                  style={{ color: "rgb(238, 34, 37)" }}
                >
                  {formatPrice(displayPrice)}
                </span>
                <span className="text-lg text-neutral-500 font-medium">
                  {displayUnit ? `/${displayUnit}` : ""}
                </span>
              </div>
              {item.discount > 0 && item.price && (
                <span className="text-xs text-neutral-400 line-through font-medium">
                  {formatPrice(item.price / (1 - item.discount / 100))}
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
            <div onClick={(e) => e.stopPropagation()} className="w-full">
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
  };

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden"
      style={{ backgroundColor: "#FFF5F5" }}
    >
      
      {/* Header is provided at App level via NavBar component */}

      {/* Global ticker moved to NavBar; keeping spacing here */}
      <div className="mb-6" />

      {/* Slideshow Banner */}
      <div className="w-full px-2 mb-4">
        <div className="overflow-hidden w-full relative rounded-xl">
          {/* Mobile: Single image slider */}
          <div className="block md:hidden relative w-full bg-white rounded-xl overflow-hidden">
            <img
              src={sliderImages[sliderIndex]}
              alt={`Banner ${sliderIndex + 1}`}
              className="w-full h-auto object-cover transition-all duration-500"
              onError={(e) => {
                console.log(
                  `Failed to load image: ${sliderImages[sliderIndex]}`
                );
                e.target.style.display = "none";
              }}
              onLoad={() => {
                console.log(
                  `Successfully loaded image: ${sliderImages[sliderIndex]}`
                );
              }}
            />
          </div>

          {/* iPad/Tablet: Single image slider */}
          <div className="hidden md:block lg:hidden relative w-full bg-white rounded-xl overflow-hidden">
            <img
              src={sliderImages[sliderIndex]}
              alt={`Banner ${sliderIndex + 1}`}
              className="w-full h-auto object-cover transition-all duration-500"
              onError={(e) => {
                console.log(
                  `Failed to load image: ${sliderImages[sliderIndex]}`
                );
                e.target.style.display = "none";
              }}
              onLoad={() => {
                console.log(
                  `Successfully loaded image: ${sliderImages[sliderIndex]}`
                );
              }}
            />
          </div>

          {/* Desktop: Three images side by side */}
          <div className="hidden lg:flex w-full h-80 xl:h-96">
            {[0, 1, 2].map((offset) => {
              const idx = (sliderIndex + offset) % sliderImages.length;
              const imageSrc = sliderImages[idx];
              return (
                <div
                  key={`${idx}-${offset}`}
                  className="w-1/3 h-full overflow-hidden"
                >
                  <img
                    src={imageSrc}
                    alt={`Banner ${idx + 1}`}
                    className="w-full h-full object-cover object-center transition-all duration-500"
                    onError={(e) => {
                      console.log(`Failed to load image: ${imageSrc}`);
                      e.target.style.display = "none";
                    }}
                    onLoad={() => {
                      console.log(`Successfully loaded image: ${imageSrc}`);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        {/* Dot Navigation */}
        <div className="flex justify-center mt-3 sm:mt-4 space-x-2">
          {sliderImages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setSliderIndex(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                sliderIndex === idx
                  ? "w-8 bg-primary-600"
                  : "w-2 bg-neutral-300 hover:bg-neutral-400"
              }`}
            />
          ))}
        </div>
      </div>
      {/* Best Sellers Section */}
      <div ref={productsRef} className="flex-1 w-full pb-12">
        <div className="w-full px-4 mt-8">
          <div className="flex flex-col items-center text-center gap-2 mb-6">
            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 bg-clip-text text-transparent animate-pulse-glow inline-block">
              ⭐ Best Sellers ⭐
            </h2>
            <p className="text-sm text-neutral-600 font-medium mt-1">
              Our most loved products picked just for you
            </p>
            {bestSellerProducts.length > 0 && (
              <span className="text-sm text-neutral-500">
                {bestSellerProducts.length} featured products
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
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
              <p className="text-neutral-600">Loading best sellers...</p>
            </div>
          ) : bestSellerProducts.length === 0 ? (
            <div className="text-center p-12 bg-white/80 backdrop-blur rounded-3xl shadow-card">
              <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                We are curating best sellers for you
              </h3>
              <p className="text-neutral-500 text-sm">
                Please check back soon for our top picks.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {bestSellerProducts.map((product) => renderProductCard(product))}
            </div>
          )}
        </div>
      </div>

      {/* Shop by Categories Section */}
      <div className="flex-1 w-full pb-12">
        <div className="w-full px-4 mt-8">
          <div className="flex flex-col items-center text-center gap-2 mb-6">
            <h2 className="text-3xl font-extrabold bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600 bg-clip-text text-transparent animate-pulse-glow inline-block">
              🛍️ Shop by Categories 🛍️
            </h2>
            <p className="text-sm text-neutral-600 font-medium mt-1">
              Explore our delicious products organized by category
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
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
              <p className="text-neutral-600">Loading categories...</p>
            </div>
          ) : shopByCategorySections.length === 0 ? (
            <div className="text-center p-12 bg-white/80 backdrop-blur rounded-3xl shadow-card">
              <h3 className="text-lg font-semibold text-neutral-800 mb-2">
                No categories available
              </h3>
              <p className="text-neutral-500 text-sm">
                Please check back soon.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              {shopByCategorySections.map(({ category, products }) => (
                <section
                  key={category}
                  className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-card border border-white/40 p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-extrabold animate-colorful-blink">
                      ✨ {category} ✨
                    </h3>
                    <button
                      onClick={() =>
                        navigate(
                          `/categories?category=${encodeURIComponent(category)}`
                        )
                      }
                      className="text-md font-semibold text-primary-600 hover:text-primary-700 transition-colors px-4 py-2 rounded-lg hover:bg-primary-50"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {products.map((product) => renderProductCard(product))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Promo image after Best Sellers - full width */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] mt-10 w-[100vw] overflow-hidden">
        <img
          src="/homepageresource.png"
          alt="Kanwarji Promo"
          className="w-full h-auto max-w-none block"
          loading="lazy"
        />
      </div>

      {/* SEO Keywords Section for search engines and users */}
      <section className="w-full px-4 py-4 mb-4 bg-yellow-50 border border-yellow-200 rounded-xl shadow-sm text-center">
        <h2 className="text-xl font-bold text-red-700 mb-2">
          Order Authentic Indian Sweets & Namkeen Online
        </h2>
        <p className="text-base text-neutral-700 mb-1">
          Buy sweets online, Buy Namkeen Online, Buy Indian Mithai Online,
          Chandni Chowk sweets, Chandni Chowk Sweets Online, Old Delhi Namkeen,
          Kanwarji Dal Biji, Desi Ghee Gulab Jamun Tin, International Shipping
          Indian Snacks, Healthy Indian Snacks, Roasted Snacks India, No
          Preservatives Namkeen, Pure Desi Ghee Sweets, Guilt-Free Indulgence,
          Dry Fruit Gift Hamper, Corporate Gift Hampers India, Diwali Gift
          Hampers, Rakhi Gift Boxes, Luxury Food Hampers, Wedding Gift Hampers,
          Traditional Indian Gift Ideas, best sweets in Delhi, kaju katli
          online, traditional Delhi sweets, heritage sweet shop Delhi, best
          namkeen in Delhi, premium dry fruits Delhi, online sweets delivery
          Delhi, sweets made in desi ghee Delhi, old Delhi mithai shop, buy
          namkeen online India, dry fruits gift box India, Diwali sweets Delhi
          delivery, Holi snacks Delhi online, corporate gift sweets Delhi,
          wedding sweets hamper Delhi, handcrafted namkeen Delhi, Delhi namkeen
          online store, pure desi ghee sweets Delhi, luxury dry fruits hamper
          India, Chandni Chowk sweet shop, heritage confectioners Delhi since
          1800s, buy sweets online India home delivery, Gujarat / Rajasthan
          sweets Delhi, healthy dry fruits for gifting, premium cashew nuts
          Delhi online, roasted pista Delhi shop, mixed dry fruits Delhi online,
          desi ghee kaju namkeen Delhi, corporate gift namkeen box India.
        </p>
      </section>

      {/* Footer (visible on Home as well) */}
      <Footer />
      {/* BottomNav is provided by App-level BottomNav component */}
    </div>
  );
};

export default HomePage;
