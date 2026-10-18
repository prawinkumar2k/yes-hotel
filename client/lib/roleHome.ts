/** Where each role lands after signing in. */
export const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: "/admin/dashboard",
  ADMIN: "/admin/dashboard",
  MANAGER: "/admin/dashboard",
  SUPERVISOR: "/admin/dashboard",
  RECEPTIONIST: "/front-desk/dashboard",
  CASHIER: "/cashier/dashboard",
  HOUSEKEEPING: "/housekeeping/dashboard",
  MAINTENANCE: "/maintenance/dashboard",
  RESTAURANT: "/restaurant/dashboard",
  FINANCE: "/finance/dashboard",
  EVENTS: "/events/dashboard",
  INVENTORY: "/inventory/dashboard",
  PROCUREMENT: "/procurement/dashboard",
  CUSTOMER: "/customer/dashboard",
};

export const roleHome = (role?: string | null) => ROLE_HOME[String(role ?? "")] || "/customer/dashboard";
