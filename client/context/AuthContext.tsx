import React, { createContext, useContext, useState, useEffect } from "react";
import {
  clearStoredAuthUser,
  getStoredAuthUser,
  setStoredAuthUser,
  AUTH_STORAGE_KEY,
  type AuthUser,
} from "@/lib/authStorage";
import { roleHome } from "@/lib/roleHome";

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

  // The session ended (renewal refused): sign out here too; the sign-in page explains why.
  useEffect(() => {
    const onExpired = () => {
      try { sessionStorage.setItem("yes_session_expired", "1"); } catch { /* private mode */ }
      setUser(null);
    };
    window.addEventListener("yes:session-expired", onExpired);
    return () => window.removeEventListener("yes:session-expired", onExpired);
  }, []);

  // One sign-in per browser: the session is shared by every tab, so when another tab signs in
  // (or out), this tab follows — otherwise it would show one person while sending another's key.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== AUTH_STORAGE_KEY) return;
      const next = getStoredAuthUser();
      setUser((current) => {
        if (!next) return null;
        if (current && current._id === next._id) return { ...current, ...next }; // token refreshed
        // Someone else signed in in another tab: open their home page here too, with a note.
        if (current) {
          try { sessionStorage.setItem("yes_hotels_switched_to", next.email || next.role); } catch { /* private mode */ }
          window.location.assign(roleHome(next.role));
        }
        return next;
      });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
