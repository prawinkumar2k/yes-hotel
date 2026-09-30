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
  const [isLoading, setIsLoading] = useState(true);
  const [currentPropertyId, setCurrentPropertyId] = useState<string | null>(null);

  // Initialize propertyId from user
  useEffect(() => {
    if (user && !currentPropertyId && (user as any).propertyId) {
      setCurrentPropertyId((user as any).propertyId);
    }
  }, [user, currentPropertyId]);

  const refreshPermissions = useCallback(async () => {
    if (!user) {
      setEffectivePermissions({});
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const url = currentPropertyId 
        ? `/permissions/users/${user._id}/effective?propertyId=${currentPropertyId}`
        : `/permissions/users/${user._id}/effective`;
      const res = await api.get(url);
      setEffectivePermissions(res.data);
    } catch (error) {
      console.error("Failed to load permissions", error);
      setEffectivePermissions({});
    } finally {
      setIsLoading(false);
    }
  }, [user, currentPropertyId]);

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
