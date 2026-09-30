import fs from 'fs';
import path from 'path';

const appTsxPath = 'c:/Users/Hp/Downloads/yes-hotels-booking-b40/client/App.tsx';
const registryPath = 'c:/Users/Hp/Downloads/yes-hotels-booking-b40/docs/PAGE_PERMISSION_REGISTRY.md';

const appTsx = fs.readFileSync(appTsxPath, 'utf-8');
const registry = fs.readFileSync(registryPath, 'utf-8');

// Extract routes from App.tsx
const routeRegex = /<Route[^>]+path=["']([^"']+)["'][^>]*>/g;
const routesInApp = [];
let match;
while ((match = routeRegex.exec(appTsx)) !== null) {
  if (match[1] !== '*' && match[1] !== '/' && match[1] !== '/booking' && match[1] !== '/admin/analytics') {
    routesInApp.push(match[1]);
  }
}

// Extract routes from registry
const registryRouteRegex = /-[^`]*`([^`]+)`/g;
const routesInRegistry = [];
while ((match = registryRouteRegex.exec(registry)) !== null) {
  // Try to match inline routes like `- `FRONT_DESK` - `/admin/front-desk``
}
// Actually let's parse the lines
const lines = registry.split('\n');
const registryEntries = [];
lines.forEach(line => {
    if (line.includes('- `') || line.match(/-\s*`?[A-Z_]+`?\s*-\s*`?\/[a-z0-z/-]+`?/)) {
        // e.g. - `FRONT_DESK` - `/admin/front-desk`
        const parts = line.split(' - ');
        if (parts.length >= 2) {
            const keyMatch = parts[0].match(/`([^`]+)`/);
            const routeMatch = parts[1].match(/`([^`]+)`/);
            
            if (keyMatch && routeMatch) {
                const keys = parts[0].match(/`([^`]+)`/g).map(s => s.replace(/`/g, ''));
                const routesMatch = parts[1].match(/`([^`]+)`/g);
                const routes = routesMatch ? routesMatch.map(s => s.replace(/`/g, '')) : [];
                
                registryEntries.push({ keys, routes });
                routesInRegistry.push(...routes);
            }
        }
    }
});

let missingInRegistry = routesInApp.filter(r => !routesInRegistry.includes(r) && r.startsWith('/admin'));
let missingInApp = routesInRegistry.filter(r => !routesInApp.includes(r));

let auditMd = '# RBAC Page Registry Audit\n\n';
auditMd += '## Routes missing in Registry\n';
missingInRegistry.forEach(r => auditMd += `- ${r}\n`);
if (missingInRegistry.length === 0) auditMd += 'None.\n';

auditMd += '\n## Routes missing in App.tsx (or misspelled)\n';
missingInApp.forEach(r => auditMd += `- ${r}\n`);
if (missingInApp.length === 0) auditMd += 'None.\n';

fs.writeFileSync('c:/Users/Hp/Downloads/yes-hotels-booking-b40/docs/RBAC_PAGE_REGISTRY_AUDIT.md', auditMd);
console.log('Audit completed');
