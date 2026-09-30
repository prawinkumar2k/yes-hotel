import fs from "fs";
import path from "path";

const root = process.cwd();
const pagesDir = path.join(root, "client", "pages");
const routesDir = path.join(root, "server", "src", "routes");
const controllersDir = path.join(root, "server", "src", "controllers");
const modelsDir = path.join(root, "server", "src", "models");

const outputPath = path.join(root, "docs", "FULL_SYSTEM_CONNECTION_MATRIX.md");

function getFiles(dir, ext) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file, ext));
    } else if (file.endsWith(ext)) {
      results.push(file);
    }
  });
  return results;
}

let report = "# FULL SYSTEM CONNECTION MATRIX\n\n";

report += "## Frontend Pages\n";
const pages = getFiles(pagesDir, ".tsx");
pages.forEach(p => {
  const rel = path.relative(pagesDir, p);
  report += `- ${rel}\n`;
});

report += "\n## Backend Routes\n";
const routes = getFiles(routesDir, ".ts");
routes.forEach(r => {
  const rel = path.relative(routesDir, r);
  report += `- ${rel}\n`;
});

report += "\n## Backend Controllers\n";
const controllers = getFiles(controllersDir, ".ts");
controllers.forEach(c => {
  const rel = path.relative(controllersDir, c);
  report += `- ${rel}\n`;
});

report += "\n## Mongoose Models\n";
const models = getFiles(modelsDir, ".ts");
models.forEach(m => {
  const rel = path.relative(modelsDir, m);
  report += `- ${rel}\n`;
});

report += "\n## PAGE CONNECTION MATRIX\n\n";
report += "| Page | Route | API Endpoints | HTTP Methods | Controller | Models |\n";
report += "|------|-------|---------------|--------------|------------|--------|\n";

// We will just do a placeholder matrix for now
report += "| Admin Front Desk | /admin | /api/front-desk/summary, /api/bookings | GET, POST | FrontDeskController, BookingController | Booking, Room, Folio |\n";
report += "| Admin Reports | /admin/reports | /api/reports/overview, /api/reports/day-summary | GET | ReportsController | Folio, Payment, Booking |\n";
report += "| ... to be completed manually ... | ... | ... | ... | ... | ... |\n";

fs.writeFileSync(outputPath, report);
console.log("Matrix generated at " + outputPath);
