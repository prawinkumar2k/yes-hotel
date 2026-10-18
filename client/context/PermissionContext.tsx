import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthContext";

type Action = "VIEW" | "CREATE" | "EDIT" | "DELETE" | "APPROVE" | "REJECT" | "EXPORT" | "PRINT" | string;

interface PermissionContextType {
  effectivePermissions: Record<string, string[]>;
  isLoading: boolean;
  hasPageAccess: (pageKey: string) => boolean;
  hasPermission: (pageKey: string, action: Action) => boolean;
  hasPropertyAccess: (propertyId: string) => boolean;
  refreshPermissions: () => Promise<void>;
  currentPropertyId: string | null;
  setCurrentPropertyId: (id: string) => void;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [effectivePermissions, setEffectivePermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  /** Whose permissions are loaded — never judge one person's access with another's list. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [currentPropertyId, setCurrentPropertyId] = useState<string | null>(null);
  const userId = user?._id ?? null;

  // Property follows the signed-in person (reset when someone else signs in).
  useEffect(() => {
    setCurrentPropertyId(((user as any)?.propertyId as string) || null);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPermissions = useCallback(async () => {
    if (!user) {
      setEffectivePermissions({});
      setLoadedFor(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const url = currentPropertyId
      ? `/permissions/users/${user._id}/effective?propertyId=${currentPropertyId}`
      : `/permissions/users/${user._id}/effective`;
    // A brief network or server hiccup must not lock staff out: try a few times.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await api.get(url);
        setEffectivePermissions(res.data);
        setLoadedFor(user._id);
        setLoading(false);
        return;
      } catch (error) {
        console.error("Failed to load permissions", error);
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    setEffectivePermissions({});
    setLoadedFor(user._id);
    setLoading(false);
  }, [userId, currentPropertyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Still loading while the list on hand belongs to someone else (e.g. right after signing in).
  const isLoading = loading || (Boolean(user) && loadedFor !== user?._id);

  useEffect(() => {
    refreshPermissions();
  }, [refreshPermissions]);

  const hasPageAccess = useCallback((pageKey: string) => {
    return !!effectivePermissions[pageKey] && effectivePermissions[pageKey].includes("VIEW");
  }, [effectivePermissions]);

  const hasPermission = useCallback((pageKey: string, action: Action) => {
    return !!effectivePermissions[pageKey] && effectivePermissions[pageKey].includes(action.toUpperCase());
  }, [effectivePermissions]);

  const hasPropertyAccess = useCallback((propertyId: string) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    
    // In a fully flushed out user model, we'd check user.propertyIds
    // For now we just check if it matches current
    const userPropId = (user as any).propertyId;
    const userPropIds = (user as any).propertyIds || [];
    return userPropId === propertyId || userPropIds.includes(propertyId);
  }, [user]);

  return (
    <PermissionContext.Provider
      value={{
        effectivePermissions,
        isLoading,
        hasPageAccess,
        hasPermission,
        hasPropertyAccess,
        refreshPermissions,
        currentPropertyId,
        setCurrentPropertyId,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionProvider");
  }
  return context;
};
