import fs from "fs";
import path from "path";

const root = process.cwd();
const frontDeskPath = path.join(root, "client", "pages", "admin", "AdminFrontDesk.tsx");
const roomRackPath = path.join(root, "client", "pages", "admin", "AdminRoomRack.tsx");

let frontDesk = fs.readFileSync(frontDeskPath, "utf-8");
let roomRack = fs.readFileSync(roomRackPath, "utf-8");

// Fix AdminFrontDesk.tsx
// Import useQuery
frontDesk = frontDesk.replace(
  'import { useQueryClient } from "@tanstack/react-query";',
  'import { useQuery, useQueryClient } from "@tanstack/react-query";'
);
// Remove duplicate availableRooms
frontDesk = frontDesk.replace(
  '  // Available Rooms for Assignment/Move\n  const [availableRooms, setAvailableRooms] = useState<any[]>([]);\n',
  ''
);
// Remove setLoading calls in openCheckOut
frontDesk = frontDesk.replace(/setLoading\(true\);/g, '');
frontDesk = frontDesk.replace(/setLoading\(false\);/g, '');
// Remove fetchSummary calls
frontDesk = frontDesk.replace(/fetchSummary\(\);/g, '');
// For the refresh button onClick
frontDesk = frontDesk.replace(/onClick=\{fetchSummary\}/g, 'onClick={() => queryClient.invalidateQueries()}');

// Fix AdminRoomRack.tsx
roomRack = roomRack.replace(/fetchRack\(\);/g, '');

fs.writeFileSync(frontDeskPath, frontDesk);
fs.writeFileSync(roomRackPath, roomRack);
console.log("Fixed TS errors");
