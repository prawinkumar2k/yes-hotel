import React from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";

interface PermissionRouteProps {
  pageKey: string;
  action?: string;
  children?: React.ReactNode;
}

export const PermissionRoute: React.FC<PermissionRouteProps> = ({ 
  pageKey, 
  action = "VIEW", 
  children 
}) => {
  const { user, isLoading: authLoading } = useAuth();
  const { 
    hasPermission, 
    isLoading: permLoading 
  } = usePermissions();
  const location = useLocation();

  if (authLoading || permLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // The hook already accounts for SUPER_ADMIN implicit full access internally
  const authorized = hasPermission(pageKey, action);

  if (!authorized) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center p-4 text-center bg-gray-50 dark:bg-gray-900">
        <div className="rounded-xl border bg-white p-8 shadow-sm dark:bg-gray-800 dark:border-gray-700 max-w-md w-full">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-500">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            You do not have permission to access this resource. If you believe this is an error, please contact your administrator.
          </p>
          <div className="text-xs text-gray-400 font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded">
            Missing: {pageKey}.{action}
          </div>
        </div>
      </div>
    );
  }

  return <>{children || <Outlet />}</>;
};
