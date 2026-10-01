import fs from "fs";

const path = "server/src/routes/admin.routes.ts";
let content = fs.readFileSync(path, "utf-8");

// Housekeeping
content = content.replace(
  'router.get("/housekeeping", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getHousekeepingTasks);',
  'router.get("/housekeeping", protect, requirePropertyAccess, requirePermission("HOUSEKEEPING", "VIEW"), getHousekeepingTasks);'
);
content = content.replace(
  'router.patch("/housekeeping/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "EDIT"), updateHousekeepingTask);',
  'router.patch("/housekeeping/:id", protect, requirePropertyAccess, requirePermission("HOUSEKEEPING", "ASSIGN"), updateHousekeepingTask);' // Housekeeping uses ASSIGN/UPDATE
);

// Maintenance
content = content.replace(
  'router.get("/maintenance", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "VIEW"), getMaintenanceTickets);',
  'router.get("/maintenance", protect, requirePropertyAccess, requirePermission("MAINTENANCE", "VIEW"), getMaintenanceTickets);'
);
content = content.replace(
  'router.post("/maintenance", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "CREATE"), createMaintenanceTicket);',
  'router.post("/maintenance", protect, requirePropertyAccess, requirePermission("MAINTENANCE", "CREATE"), createMaintenanceTicket);'
);
content = content.replace(
  'router.patch("/maintenance/:id", protect, requirePropertyAccess, requirePermission("DASHBOARD.ADMIN", "EDIT"), updateMaintenanceTicket);',
  'router.patch("/maintenance/:id", protect, requirePropertyAccess, requirePermission("MAINTENANCE", "UPDATE"), updateMaintenanceTicket);'
);

fs.writeFileSync(path, content);
console.log("Fixed permissions");
