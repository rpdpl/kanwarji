import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { apiPost } from "../utils/axiosInstance";
import { FaUser, FaLock, FaPhone } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import { IoChevronBack } from "react-icons/io5";
import { IoEyeOutline, IoEyeOffOutline } from "react-icons/io5";

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agree: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // New states for OTP verification
  const [showOtpVerification, setShowOtpVerification] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.agree) {
      toast.error("Please agree to the Terms & Conditions and Privacy Policy");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      console.log("Submitting registration data:", {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: "***",
      });

      console.log("Making API call to /api/auth/signup...");

      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Request timeout after 30 seconds")),
          30000
        )
      );

      const apiPromise = apiPost("/api/auth/signup", {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });

      const res = await Promise.race([apiPromise, timeoutPromise]);

      console.log("Registration response received:", res);
      console.log("Response data:", res.data);
      console.log("Response status:", res.status);

      if (res.data && res.data.success) {
        // The server sends OTP for email verification, so show OTP form
        console.log("Registration successful, OTP sent for verification");
        toast.success(
          res.data.message ||
            "Account created! Please check your email for OTP verification."
        );

        // Show OTP verification form instead of redirecting
        setShowOtpVerification(true);
      } else {
        console.log("Registration failed - success flag is false");
        console.log("Response data:", res.data);
        toast.error(
          res.data?.message || "Registration failed - please try again"
        );
      }
    } catch (error) {
      console.error("Registration error caught:", error);
      console.error("Error type:", error.constructor.name);
      console.error("Error message:", error.message);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);

      if (error.message === "Request timeout after 30 seconds") {
        toast.error(
          "Request timed out. Please check your connection and try again."
        );
      } else {
        toast.error(
          error.response?.data?.message ||
            error.message ||
            "Registration failed - please try again"
        );
      }
    } finally {
      setLoading(false);
      console.log("Registration process completed, loading set to false");
    }
  };

  // Handle OTP verification
  const handleOtpVerification = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setOtpLoading(true);
    try {
      console.log("Verifying OTP for email:", formData.email);

      const res = await apiPost("/api/auth/verify-otp", {
        email: formData.email,
        otp: otp,
      });

      console.log("OTP verification response:", res.data);

      if (res.data && res.data.success) {
        toast.success(res.data.message || "Email verified successfully!");

        // Redirect to login after successful verification
        setTimeout(() => {
          navigate("/login", {
            state: {
              email: formData.email,
              message: "Account verified! You can now login.",
            },
          });
        }, 1500);
      } else {
        toast.error(res.data?.message || "Invalid OTP. Please try again.");
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "OTP verification failed"
      );
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-100 via-peach-200 to-warm-300 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Back Arrow */}
        <button
          className="mb-4 p-2 rounded-lg hover:bg-white/80 transition-colors animate-fade-in"
          onClick={() => {
            if (showOtpVerification) {
              setShowOtpVerification(false);
            } else {
              navigate(-1);
            }
          }}
          aria-label="Back"
        >
          <IoChevronBack className="text-2xl text-neutral-700" />
        </button>

        {showOtpVerification ? (
          // OTP Verification Form
          <div className="bg-white rounded-3xl shadow-elevated p-8 animate-slide-up">
            <div className="flex justify-center mb-6 animate-bounce-subtle">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-100 to-orange-100 flex items-center justify-center shadow-soft">
                <MdEmail className="text-primary-600 text-3xl" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-primary-600 via-orange-600 to-amber-600 bg-clip-text text-transparent">
              🔐 Verify Your Email 🔐
            </h2>
            <p className="text-neutral-600 text-center mb-8 text-base font-medium">
              Please enter the 6-digit OTP sent to {formData.email}
            </p>

            <form onSubmit={handleOtpVerification} className="space-y-6">
              <div>
                <label className="block mb-2 text-sm font-semibold text-neutral-700">
                  Enter OTP
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full bg-neutral-50 rounded-xl px-4 py-4 border border-neutral-200 text-center text-3xl tracking-[0.5em] font-semibold text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                  placeholder="000000"
                  maxLength="6"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={otpLoading || otp.length !== 6}
                className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold text-base shadow-soft hover:shadow-card hover:from-primary-700 hover:to-primary-800 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {otpLoading ? (
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
                    Verifying...
                  </span>
                ) : (
                  "Verify OTP"
                )}
              </button>
            </form>

            <p className="text-center mt-6 text-base text-neutral-600">
              Didn't receive the OTP?{" "}
              <button
                onClick={() => {
                  toast.info("OTP resend functionality coming soon!");
                }}
                className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
              >
                Resend
              </button>
            </p>
          </div>
        ) : (
          // Registration Form
          <div className="bg-white rounded-3xl shadow-elevated p-8 animate-slide-up">
            <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-primary-600 via-orange-600 to-amber-600 bg-clip-text text-transparent">
              🎉 Join Us Today! 🎉
            </h1>
            <p className="text-neutral-600 text-center mb-8 text-base font-medium">
              Start your delicious journey with us
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block mb-2 text-sm font-semibold text-neutral-700">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FaUser className="text-neutral-400 text-sm" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>
              {/* Email Address */}
              <div>
                <label className="block mb-2 text-sm font-semibold text-neutral-700">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MdEmail className="text-neutral-400 text-sm" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="Enter your email address"
                    required
                  />
                </div>
              </div>
              {/* Phone Number */}
              <div>
                <label className="block mb-2 text-sm font-semibold text-neutral-700">
                  Phone Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FaPhone className="text-neutral-400 text-sm" />
                  </div>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="Enter your phone number"
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
                    placeholder="Create a strong password"
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
              {/* Confirm Password */}
              <div>
                <label className="block mb-2 text-sm font-semibold text-neutral-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <FaLock className="text-neutral-400 text-sm" />
                  </div>
                  <input
                    type={showConfirm ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-11 pr-12 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="Re-enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    tabIndex={-1}
                  >
                    {showConfirm ? (
                      <IoEyeOffOutline size={20} />
                    ) : (
                      <IoEyeOutline size={20} />
                    )}
                  </button>
                </div>
              </div>
              {/* Terms & Conditions */}
              <div className="flex items-start gap-3 mt-2">
                <input
                  type="checkbox"
                  name="agree"
                  checked={formData.agree}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 focus:ring-2 transition-all cursor-pointer"
                  required
                />
                <span className="text-sm text-neutral-600">
                  I agree to the{" "}
                  <a
                    href="/terms"
                    className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Terms & Conditions
                  </a>{" "}
                  and{" "}
                  <a
                    href="/privacy"
                    className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Privacy Policy
                  </a>
                </span>
              </div>
              {/* Create Account Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-semibold text-base shadow-soft hover:shadow-card hover:from-primary-700 hover:to-primary-800 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
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
                    Creating...
                  </span>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            {/* Sign In */}
            <p className="text-center mt-8 text-base text-neutral-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
              >
                Sign In
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
