import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { apiPost } from "../utils/axiosInstance";
import { FaUser, FaLock } from "react-icons/fa";
import { IoEyeOutline, IoEyeOffOutline } from "react-icons/io5";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({ emailOrPhone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Show message from registration if user was redirected
  useEffect(() => {
    if (location.state?.message) {
      toast.info(location.state.message);
      // Pre-fill email if provided
      if (location.state?.email) {
        setFormData((prev) => ({
          ...prev,
          emailOrPhone: location.state.email,
        }));
      }
    }
  }, [location.state]);

  // Support redirect via query param (e.g. /login?redirect=/checkout&source=checkout-proceed)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get("redirect");
    if (redirect) {
      // store temporarily in sessionStorage to be used after successful login
      sessionStorage.setItem("redirectAfterLogin", decodeURIComponent(redirect));
      const source = params.get("source");
      if (source) sessionStorage.setItem("loginSource", source);
    }
  }, [location.search]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiPost("/api/auth/login", formData);
      if (res.data.success) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        toast.success(res.data.message || "Login successful!");

        // Trigger cart-updated event to refresh navbar/bottomnav
        // Merge guest cart (if any) into the user's server cart when login was initiated from checkout
        try {
          const redirectPath = sessionStorage.getItem("redirectAfterLogin");

          // Only perform guest cart merge if there is a guest cart present
          const raw = localStorage.getItem("guestCart");
          const guestItems = raw ? JSON.parse(raw) : [];

          if (guestItems && guestItems.length > 0) {
            const user = res.data.user || JSON.parse(localStorage.getItem("user") || "null");
            const userId = user?.id || user?._id;
            if (userId) {
              // send each item to server add endpoint (backend accepts quantity)
              for (const it of guestItems) {
                const productId = it.productId || it._id || it.id;
                const quantity = it.quantity || 1;
                try {
                  await apiPost("/api/cart/add", { userId, productId, quantity });
                } catch (mergeErr) {
                  // non-fatal: continue merging other items
                  console.warn("Failed to add guest item during merge:", mergeErr);
                }
              }
              // clear guest cart after attempting merge
              localStorage.removeItem("guestCart");
            }
          }

          // notify UI to refresh cart (CartContext listens for this)
          window.dispatchEvent(new Event("cart-updated"));
        } catch (e) {
          console.warn("Error during guest cart merge:", e);
          window.dispatchEvent(new Event("cart-updated"));
        }

        // Check if there's a redirect path (e.g., from checkout)
        const redirectPath = sessionStorage.getItem("redirectAfterLogin");
        if (redirectPath) {
          sessionStorage.removeItem("redirectAfterLogin");
          sessionStorage.removeItem("loginSource");
          navigate(redirectPath);
        } else {
          navigate("/home");
        }
      } else {
        toast.error(res.data.message || "Login failed");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || error.message || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-100 via-peach-200 to-warm-300 px-4 py-8">
      <div className="w-full max-w-md">
        
        {/* Logo */}
        <div className="flex justify-center mb-8 animate-bounce-subtle">
          <img
            src="/logo1.png"
            alt="Kanwarji Logo"
            className="h-20 w-auto"
            style={{ objectFit: "contain" }}
          />
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-3xl shadow-elevated p-8 animate-slide-up">
          {/* Heading */}
          <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-primary-600 via-orange-600 to-amber-600 bg-clip-text text-transparent">
            ✨ Hey there! ✨
          </h1>
          <p className="text-neutral-600 text-center mb-8 text-base font-medium">
            Please login to proceed
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email or Phone */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-neutral-700">
                Email or Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FaUser className="text-neutral-400 text-sm" />
                </div>
                <input
                  type="text"
                  name="emailOrPhone"
                  value={formData.emailOrPhone}
                  onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                  placeholder="Enter your email or phone number"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block mb-2 text-sm font-semibold text-neutral-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FaLock className="text-neutral-400 text-sm" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-11 pr-12 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <IoEyeOffOutline size={20} />
                  ) : (
                    <IoEyeOutline size={20} />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <Link
                to="/reset-password"
                className="text-primary-600 hover:text-primary-700 font-medium text-sm transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold text-base shadow-soft hover:shadow-card hover:from-primary-700 hover:to-primary-800 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                  Logging in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Sign Up */}
          <p className="text-center mt-8 text-base text-neutral-600">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
            >
              Create Account
            </Link>
          </p>

          {/* Continue Browsing */}
          <p className="text-center mt-4 text-base text-neutral-600">
            <Link
              to="/home"
              className="text-neutral-600 hover:text-neutral-900 font-medium transition-colors underline"
            >
              Continue browsing without login
            </Link>
          </p>
        </div>

        {/* Footer Text */}
        <p className="text-center mt-6 text-sm text-neutral-500">
          By continuing, you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default Login;
