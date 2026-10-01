import fs from "fs";

const path = "server/src/routes/admin.routes.ts";
let content = fs.readFileSync(path, "utf-8");

content = content.replace(/requirePermission\("BOOKINGS", "UPDATE"\)/g, 'requirePermission("BOOKINGS", "EDIT")');
content = content.replace(/requirePermission\("ENQUIRIES", "UPDATE"\)/g, 'requirePermission("ENQUIRIES", "EDIT")');
content = content.replace(/requirePermission\("ROOM_CATEGORIES", "UPDATE"\)/g, 'requirePermission("ROOM_CATEGORIES", "EDIT")');

fs.writeFileSync(path, content);
console.log("Fixed UPDATE to EDIT in admin.routes.ts");
