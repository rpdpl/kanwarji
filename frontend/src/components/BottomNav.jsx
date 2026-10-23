import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { IoHomeOutline } from "react-icons/io5";
import { MdCategory, MdDiscount } from "react-icons/md";
import { FaUserCircle } from "react-icons/fa";
import { apiGet } from "../utils/axiosInstance";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname || "/";
  const [profileDropup, setProfileDropup] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const isActive = (p) => {
    if (p === "/home") return path === "/home" || path === "/";
    return path.startsWith(p);
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const me = await apiGet("/api/auth/me");
        setIsLoggedIn(me.data.success);
      } catch (err) {
        setIsLoggedIn(false);
      }
    };
    checkAuth();

    const handler = () => checkAuth();
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropup && !e.target.closest(".relative")) {
        setProfileDropup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileDropup]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-peach-50/95 backdrop-blur-md border-t border-warm-200 flex justify-around items-center py-2 z-50 shadow-elevated">
      <Link
        to="/home"
        className={`flex flex-col items-center min-w-[70px] transition-all ${
          isActive("/home")
            ? "text-primary-600"
            : "text-neutral-700 hover:text-neutral-900"
        }`}
      >
        <IoHomeOutline
          className={`text-3xl transition-transform ${
            isActive("/home") ? "scale-110" : ""
          }`}
        />
        <span className="text-sm font-semibold mt-2">Home</span>
        {isActive("/home") && (
          <div className="w-1 h-1 rounded-full bg-primary-600 mt-1" />
        )}
      </Link>
      <Link
        to="/categories"
        className={`flex flex-col items-center min-w-[70px] transition-all ${
          isActive("/categories")
            ? "text-primary-600"
            : "text-neutral-700 hover:text-neutral-900"
        }`}
      >
        <MdCategory
          className={`text-3xl transition-transform ${
            isActive("/categories") ? "scale-110" : ""
          }`}
        />
        <span className="text-sm font-semibold mt-2">Categories</span>
        {isActive("/categories") && (
          <div className="w-1 h-1 rounded-full bg-primary-600 mt-1" />
        )}
      </Link>
      <Link
        to="/discount"
        className={`flex flex-col items-center min-w-[70px] transition-all ${
          isActive("/discount")
            ? "text-primary-600"
            : "text-neutral-700 hover:text-neutral-900"
        }`}
      >
        <MdDiscount
          className={`text-3xl transition-transform ${
            isActive("/discount") ? "scale-110" : ""
          }`}
        />
        <span className="text-sm font-semibold mt-2">Discount</span>
        {isActive("/discount") && (
          <div className="w-1 h-1 rounded-full bg-primary-600 mt-1" />
        )}
      </Link>
      <div className="relative">
        {isLoggedIn ? (
          <Link
            to="/profile"
            className={`flex flex-col items-center min-w-[70px] transition-all ${
              isActive("/profile")
                ? "text-primary-600"
                : "text-neutral-700 hover:text-neutral-900"
            }`}
          >
            <FaUserCircle
              className={`text-3xl transition-transform ${
                isActive("/profile") ? "scale-110" : ""
              }`}
            />
            <span className="text-sm font-semibold mt-2">Profile</span>
            {isActive("/profile") && (
              <div className="w-1 h-1 rounded-full bg-primary-600 mt-1" />
            )}
          </Link>
        ) : (
          <>
            <button
              onClick={() => setProfileDropup(!profileDropup)}
              className="flex flex-col items-center min-w-[70px] transition-all text-neutral-700 hover:text-neutral-900"
            >
              <FaUserCircle className="text-3xl" />
              <span className="text-sm font-semibold mt-2">Profile</span>
            </button>
            {profileDropup && (
              <div className="absolute bottom-full right-1/2 transform translate-x-1/2 mb-2 w-48 bg-white rounded-xl shadow-elevated border border-neutral-200 py-2 z-50 animate-slide-up">
                <button
                  onClick={() => {
                    setProfileDropup(false);
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
    </nav>
  );
};

export default BottomNav;
