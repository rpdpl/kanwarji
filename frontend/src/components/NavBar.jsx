import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  FaShoppingCart,
  FaUser,
  FaSearch,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import logo1 from "../assets/logo1.png";
import { useCart } from "../context/CartContext";
import CartSidebar from "./CartSidebar";

const NavBar = () => {
  const { cart } = useCart();
  const [cartSidebarOpen, setCartSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggedInRef = useRef(false);
  const headerRef = useRef(null);

  // Set isLoggedIn based on token in localStorage
  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("token"));
    const handleLogout = () => setIsLoggedIn(false);
    window.addEventListener("logout", handleLogout);
    return () => {
      window.removeEventListener("logout", handleLogout);
    };
  }, []);

  // Categories to show in navbar
  const navCategories = [
    "Savory",
    "Namkeen",
    "Sweet",
    "Travel Pack Combo",
    "Value Pack Offers",
    "Gift Packs",
  ];

  // Check if we're on pages that need sticky navbar
  const isProductPage = location.pathname.startsWith("/product/");
  const isHomePage = location.pathname === "/home" || location.pathname === "/";
  const isCategoriesPage = location.pathname === "/categories";
  const isDiscountPage = location.pathname === "/discount";
  const isCheckoutPage = location.pathname === "/checkout";
  const isProfilePage = location.pathname === "/profile";
  const isContactPage = location.pathname === "/contact";

  const shouldBeSticky =
    isProductPage ||
    isHomePage ||
    isCategoriesPage ||
    isDiscountPage ||
    isCheckoutPage ||
    isProfilePage ||
    isContactPage;

  // Use cart.totalItems for count
  const count = cart.totalItems || 0;

  // Close dropdown and mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdown && !e.target.closest(".profile-dropdown-container")) {
        setProfileDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileDropdown]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    isLoggedInRef.current = isLoggedIn;
  }, [isLoggedIn]);

  // Measure header height and set a CSS variable for global spacer
  useEffect(() => {
    const setHeaderOffset = () => {
      try {
        const el = headerRef.current;
        if (!el) return;
        const h = el.offsetHeight || 0;
        document.documentElement.style.setProperty("--header-offset", `${h}px`);
      } catch (_) {}
    };
    setHeaderOffset();
    const onResize = () => setHeaderOffset();
    window.addEventListener("resize", onResize);
    const id = setInterval(setHeaderOffset, 500); // handle dynamic content/FF quirks
    return () => {
      window.removeEventListener("resize", onResize);
      clearInterval(id);
    };
  }, []);

  // Block guest cart writes globally and redirect to login
  // Previously we blocked guest cart writes here which forced users to login
  // while browsing. Remove that behavior so guests can build a local cart.

  // Use fixed positioning instead of sticky for consistent behavior across pages
  // (user reported sticky not appearing to work). We add spacers in App layout.
  return (
    <div>
      <div
        ref={headerRef}
        className={`${shouldBeSticky ? "fixed top-0 left-0 right-0 z-50" : ""}`}
      >
        {/* Global Ticker Banner at the very top */}
        <div className="w-full bg-primary-600 border-b border-primary-700 shadow-sm overflow-hidden">
          <div className="relative flex items-center h-6 sm:h-7 md:h-8">
            {/* Animated ticker text */}
            <div className="absolute whitespace-nowrap animate-ticker">
              {[...Array(8)].map((_, i) => (
                <span
                  key={i}
                  className="inline-flex items-center text-xs sm:text-sm font-semibold text-white px-3 sm:px-4"
                >
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-white flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Serving sweetness and smiles for 175 years – Authentic Sweets,
                  Namkeen & Chats from Kanwarji!
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4 ml-1.5 sm:ml-2 text-white flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Logo Bar Above Navbar */}
        <div
          className="flex items-center justify-between px-3 sm:px-6 md:px-8 py-2 sm:py-3 border-b border-neutral-200"
          style={{ backgroundColor: "#FFF5F5" }}
        >
          {/* Left: Hamburger (Mobile) + Logo */}
          <div className="flex items-center gap-2 sm:gap-0">
            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center text-neutral-700 hover:bg-neutral-100 p-2 rounded-lg transition-all active:scale-95"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
            </button>

            <Link
              to="/home"
              className="cursor-pointer inline-flex items-center"
            >
              <img
                src={logo1}
                alt="Logo"
                className="h-10 sm:h-12 md:h-14"
                style={{ objectFit: "contain" }}
              />
            </Link>
          </div>

          {/* Right: Search + Cart + Profile/Account */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search */}
            <div className="flex items-center bg-white border-2 border-primary-500 rounded-xl px-2 sm:px-2.5 py-1 sm:py-1.5 shadow-soft focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent">
              <FaSearch className="text-neutral-500" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    navigate(
                      `/categories?search=${encodeURIComponent(
                        searchQuery.trim()
                      )}`
                    );
                    setSearchQuery("");
                  }
                  if (e.key === "Escape") {
                    setSearchQuery("");
                  }
                }}
                placeholder="Search"
                className="ml-1 sm:ml-2 bg-transparent outline-none text-xs sm:text-sm text-neutral-700 placeholder:text-neutral-400 w-20 sm:w-36 md:w-56"
              />
            </div>

            {/* Cart */}
            <button
              onClick={() => {
                // Open cart sidebar for both guests and logged-in users.
                setCartSidebarOpen(true);
              }}
              className="flex items-center text-neutral-700 hover:bg-neutral-100 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-all active:scale-95 relative"
              aria-label="Cart"
            >
              <FaShoppingCart size={18} className="sm:w-5 sm:h-5" />
              {count > 0 && (
                <span
                  className="absolute -top-1 -right-1 text-white text-xs font-semibold rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center shadow-soft"
                  style={{ backgroundColor: "rgb(238, 34, 37)" }}
                >
                  {count}
                </span>
              )}
              <span className="ml-1 sm:ml-2 hidden sm:inline font-semibold text-sm">
                Cart
              </span>
            </button>

            {/* Profile (shows login/register if not logged in) */}
            <div className="relative profile-dropdown-container">
              {isLoggedIn ? (
                <Link
                  to="/profile"
                  className="flex items-center text-neutral-700 hover:bg-neutral-100 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-all active:scale-95"
                  aria-label="Profile"
                >
                  <FaUser size={16} className="sm:w-[18px] sm:h-[18px]" />
                  <span className="ml-1 sm:ml-2 hidden sm:inline font-semibold text-sm">
                    Profile
                  </span>
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => setProfileDropdown(!profileDropdown)}
                    className="flex items-center text-neutral-700 hover:bg-neutral-100 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition-all active:scale-95"
                    aria-label="Profile"
                  >
                    <FaUser size={16} className="sm:w-[18px] sm:h-[18px]" />
                    <span className="ml-1 sm:ml-2 hidden sm:inline font-semibold text-sm">
                      Profile
                    </span>
                  </button>
                  {profileDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-elevated border border-neutral-200 py-2 z-50 animate-slide-up">
                      <button
                        onClick={() => {
                          setProfileDropdown(false);
                          navigate("/login");
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-neutral-50 text-neutral-700 font-medium transition-colors"
                      >
                        Login / Register
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Red Navbar - Desktop */}
        <nav
          className="hidden md:block text-white shadow-soft"
          style={{
            backgroundColor: "rgb(238, 34, 37)",
            borderBottom: "2px solid rgb(200, 20, 22)",
          }}
        >
          <div className="flex items-center w-full px-4 py-1 gap-3">
            {/* Categories list */}
            <div className="flex-1 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-4 min-w-max">
                {/* Home button */}
                <button
                  onClick={() => navigate("/")}
                  className="px-3 py-0.5 rounded-lg font-semibold text-sm hover:bg-white/10 active:scale-95 whitespace-nowrap"
                >
                  Home
                </button>
                {navCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() =>
                      navigate(
                        `/categories?category=${encodeURIComponent(cat)}`
                      )
                    }
                    className="px-3 py-0.5 rounded-lg font-semibold text-sm hover:bg-white/10 active:scale-95 whitespace-nowrap"
                  >
                    {cat}
                  </button>
                ))}
                {/* Discount shortcut after Gift Packs */}
                <button
                  onClick={() => navigate("/discount")}
                  className="px-3 py-0.5 rounded-lg font-semibold text-sm hover:bg-white/10 active:scale-95 whitespace-nowrap"
                >
                  Discount
                </button>
              </div>
            </div>

            {/* Static pages */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/about")}
                className="px-3 py-0.5 rounded-lg font-semibold text-sm hover:bg-white/10 active:scale-95 whitespace-nowrap"
              >
                About us
              </button>
              <button
                onClick={() => navigate("/contact")}
                className="px-3 py-0.5 rounded-lg font-semibold text-sm hover:bg-white/10 active:scale-95 whitespace-nowrap"
              >
                Contact us
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile Slide-out Menu */}
        <div
          className={`md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          className={`md:hidden fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-800">Menu</h2>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="text-neutral-600 hover:text-neutral-800 p-2"
            >
              <FaTimes size={20} />
            </button>
          </div>

          {/* Mobile Menu Content */}
          <div className="p-4">
            {/* Home */}
            <button
              onClick={() => navigate("/")}
              className="w-full text-left px-4 py-3 text-neutral-800 font-semibold hover:bg-primary-50 rounded-lg transition-colors"
            >
              Home
            </button>

            {/* Categories */}
            <div className="mt-2">
              <h3 className="px-4 py-2 text-xs font-bold text-neutral-500 uppercase">
                Categories
              </h3>
              {navCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    navigate(`/categories?category=${encodeURIComponent(cat)}`)
                  }
                  className="w-full text-left px-4 py-3 text-neutral-700 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Discount */}
            <button
              onClick={() => navigate("/discount")}
              className="w-full text-left px-4 py-3 mt-2 text-neutral-800 font-semibold hover:bg-primary-50 rounded-lg transition-colors"
            >
              Discount
            </button>

            {/* Divider */}
            <div className="my-4 border-t border-neutral-200" />

            {/* Static Pages */}
            <button
              onClick={() => navigate("/about")}
              className="w-full text-left px-4 py-3 text-neutral-700 hover:bg-primary-50 rounded-lg transition-colors"
            >
              About us
            </button>
            <button
              onClick={() => navigate("/contact")}
              className="w-full text-left px-4 py-3 text-neutral-700 hover:bg-primary-50 rounded-lg transition-colors"
            >
              Contact us
            </button>
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={cartSidebarOpen}
        onClose={() => setCartSidebarOpen(false)}
      />
    </div>
  );
};

export default NavBar;
