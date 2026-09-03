import React, { createContext, useContext, useState, useEffect } from "react";
import {
  clearStoredAuthUser,
  getStoredAuthUser,
  setStoredAuthUser,
  type AuthUser,
} from "@/lib/authStorage";

interface AuthContextType {
  user: AuthUser | null;
  login: (userData: AuthUser) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = getStoredAuthUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = (userData: AuthUser) => {
    setUser(userData);
    setStoredAuthUser(userData);
  };

  const logout = () => {
    setUser(null);
    clearStoredAuthUser();
    // Revoke the refresh-token cookie server-side — fire-and-forget, since
    // the client-side session is already cleared regardless of the result.
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
