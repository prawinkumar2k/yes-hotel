import fs from 'fs';
import path from 'path';

const dir = './client';
const replacements = [
  { search: /"ADR"/g, replace: '"Average Room Price Per Night"' },
  { search: />ADR</g, replace: '>Average Room Price Per Night<' },
  { search: /"RevPAR"/g, replace: '"Revenue Per Available Room"' },
  { search: />RevPAR</g, replace: '>Revenue Per Available Room<' },
  { search: /"PMS"/g, replace: '"Hotel Management System"' },
  { search: />PMS</g, replace: '>Hotel Management System<' },
  { search: /"POS"/g, replace: '"Restaurant Billing"' },
  { search: />POS</g, replace: '>Restaurant Billing<' },
  { search: /"KDS"/g, replace: '"Kitchen Order Display"' },
  { search: />KDS</g, replace: '>Kitchen Order Display<' },
  { search: /"OTA"/g, replace: '"Online Travel Agency"' },
  { search: />OTA</g, replace: '>Online Travel Agency<' },
  { search: /"RBAC"/g, replace: '"User Access Permissions"' },
  { search: />RBAC</g, replace: '>User Access Permissions<' },
  { search: /"KYC"/g, replace: '"Guest Identity Verification"' },
  { search: />KYC</g, replace: '>Guest Identity Verification<' },
  { search: /"API Error"/g, replace: '"Something went wrong. Please try again."' },
  { search: />API Error</g, replace: '>Something went wrong. Please try again.<' },
  { search: /"Folio"/g, replace: '"Guest Bill"' },
  { search: />Folio</g, replace: '>Guest Bill<' },
  { search: /"Folios"/g, replace: '"Guest Bills"' },
  { search: />Folios</g, replace: '>Guest Bills<' },
  { search: /"UPI"/g, replace: '"Unified Payments Interface"' },
  { search: />UPI</g, replace: '>Unified Payments Interface<' },
  { search: /"Occupancy"/g, replace: '"Occupied Rooms"' },
  { search: />Occupancy</g, replace: '>Occupied Rooms<' }
];

function processDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (let entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      for (const r of replacements) {
        if (content.match(r.search)) {
          content = content.replace(r.search, r.replace);
          modified = true;
        }
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log("Updated:", fullPath);
      }
    }
  }
}
processDir(dir);
