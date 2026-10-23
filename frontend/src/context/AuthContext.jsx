import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getMe } from "../api/auth";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const res = await getMe();
      if (res.data?.success && res.data.user) {
        setUser(res.data.user);
        return res.data.user;
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const onAuthUpdated = () => {
      setLoading(true);
      refreshUser();
    };
    const onLogout = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("auth-updated", onAuthUpdated);
    window.addEventListener("logout", onLogout);
    return () => {
      window.removeEventListener("auth-updated", onAuthUpdated);
      window.removeEventListener("logout", onLogout);
    };
  }, [refreshUser]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.dispatchEvent(new Event("logout"));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      refreshUser,
      setUser,
      logout,
      userId: user?.id || user?._id || null,
    }),
    [user, loading, refreshUser, logout]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

export default AuthContext;
