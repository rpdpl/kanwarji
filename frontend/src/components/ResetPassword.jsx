import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { apiPost } from "../utils/axiosInstance";
import { MdEmail, MdLock } from "react-icons/md";
import { IoChevronBack } from "react-icons/io5";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1: Send OTP to email
  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiPost("/api/forgot-password", { email });
      if (res.data.success) {
        toast.success(res.data.message || "Verification code sent!");
        setStep(2); // Move to OTP verification step
      } else {
        toast.error(
          res.data.error || res.data.message || "Failed to send code"
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          "Failed to send code"
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost("/api/verify-otp", { email, otp });
      if (res.data.success) {
        toast.success(res.data.message || "OTP verified successfully!");
        setResetToken(res.data.token);
        setStep(3); // Move to password reset step
      } else {
        toast.error(res.data.error || res.data.message || "Invalid OTP");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          "Invalid OTP"
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost("/api/reset-password", {
        email,
        token: resetToken,
        password,
      });
      if (res.data.success) {
        toast.success(res.data.message || "Password reset successfully!");
        setTimeout(() => {
          navigate("/login"); // Navigate to login page
        }, 2000);
      } else {
        toast.error(
          res.data.error || res.data.message || "Failed to reset password"
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          "Failed to reset password"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate(-1);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return "Reset Password";
      case 2:
        return "Verify OTP";
      case 3:
        return "New Password";
      default:
        return "Reset Password";
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 1:
        return "Enter your email address to receive a verification code";
      case 2:
        return "Enter the 6-digit code sent to your email";
      case 3:
        return "Create a new password for your account";
      default:
        return "Enter your email address to receive a verification code";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-warm-100 via-peach-200 to-warm-300 px-4 py-8">
      <div className="w-full max-w-md">
        {/* Back Arrow */}
        <button
          className="mb-4 p-2 rounded-lg hover:bg-white/80 transition-colors animate-fade-in"
          onClick={handleBack}
          aria-label="Back"
        >
          <IoChevronBack className="text-2xl text-neutral-700" />
        </button>

        {/* Card Container */}
        <div className="bg-white rounded-3xl shadow-elevated p-8 animate-slide-up">
          {/* Icon */}
          <div className="flex justify-center mb-6 animate-bounce-subtle">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-orange-100 rounded-2xl p-4 flex items-center justify-center shadow-soft">
              {step === 3 ? (
                <MdLock className="text-primary-600 text-4xl" />
              ) : (
                <MdEmail className="text-primary-600 text-4xl" />
              )}
            </div>
          </div>
          {/* Heading */}
          <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-primary-600 via-orange-600 to-amber-600 bg-clip-text text-transparent">
            🔒 {getStepTitle()} 🔒
          </h1>
          <p className="text-neutral-600 text-center mb-8 text-base font-medium">
            {getStepDescription()}
          </p>
          {/* Steps Progress */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center w-full max-w-xs">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`${
                    step >= 1
                      ? "bg-primary-600 text-white shadow-soft"
                      : "bg-neutral-200 text-neutral-500"
                  } rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm transition-all duration-300`}
                >
                  1
                </div>
                <div
                  className={`h-1 w-full mt-2 rounded transition-colors ${
                    step >= 1 ? "bg-primary-600" : "bg-neutral-200"
                  }`}
                ></div>
              </div>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`${
                    step >= 2
                      ? "bg-primary-600 text-white shadow-soft"
                      : "bg-neutral-200 text-neutral-500"
                  } rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm transition-all duration-300`}
                >
                  2
                </div>
                <div
                  className={`h-1 w-full mt-2 rounded transition-colors ${
                    step >= 2 ? "bg-primary-600" : "bg-neutral-200"
                  }`}
                ></div>
              </div>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`${
                    step >= 3
                      ? "bg-primary-600 text-white shadow-soft"
                      : "bg-neutral-200 text-neutral-500"
                  } rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm transition-all duration-300`}
                >
                  3
                </div>
                <div
                  className={`h-1 w-full mt-2 rounded transition-colors ${
                    step >= 3 ? "bg-primary-600" : "bg-neutral-200"
                  }`}
                ></div>
              </div>
            </div>
          </div>

          {/* Step 1: Email Input */}
          {step === 1 && (
            <form onSubmit={handleSendOTP} className="space-y-5">
              <div>
                <label className="block mb-2 text-sm font-semibold text-neutral-700">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MdEmail className="text-neutral-400 text-lg" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="Enter your registered email"
                    required
                  />
                </div>
              </div>
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
                    Sending...
                  </span>
                ) : (
                  "Send Verification Code"
                )}
              </button>
            </form>
          )}

          {/* Step 2: OTP Input */}
          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div>
                <label className="block mb-2 text-sm font-semibold text-neutral-700">
                  Verification Code
                </label>
                <input
                  type="text"
                  name="otp"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full px-4 py-4 bg-neutral-50 border border-neutral-200 rounded-xl text-center text-3xl tracking-[0.5em] font-semibold text-primary-600 placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                  placeholder="000000"
                  maxLength="6"
                  required
                />
                <p className="text-sm text-neutral-500 mt-3 text-center">
                  Code sent to{" "}
                  <span className="font-semibold text-neutral-700">
                    {email}
                  </span>
                </p>
              </div>
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
                    Verifying...
                  </span>
                ) : (
                  "Verify Code"
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-2 text-primary-600 hover:text-primary-700 font-semibold text-sm transition-colors"
              >
                Resend Code
              </button>
            </form>
          )}

          {/* Step 3: New Password Input */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block mb-2 text-sm font-semibold text-neutral-700">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MdLock className="text-neutral-400 text-lg" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="Enter new password"
                    required
                    minLength="6"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    {showPassword ? (
                      <AiOutlineEyeInvisible size={20} />
                    ) : (
                      <AiOutlineEye size={20} />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-neutral-700">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MdLock className="text-neutral-400 text-lg" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white transition-all"
                    placeholder="Confirm new password"
                    required
                    minLength="6"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <AiOutlineEyeInvisible size={20} />
                    ) : (
                      <AiOutlineEye size={20} />
                    )}
                  </button>
                </div>
              </div>
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
                    Resetting...
                  </span>
                ) : (
                  "Reset Password"
                )}
              </button>
            </form>
          )}

          {/* Back to Login */}
          <p className="text-center mt-8 text-base text-neutral-600">
            Remember your password?{" "}
            <Link
              to="/login"
              className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
            >
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
