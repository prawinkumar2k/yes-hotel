const fs = require('fs');
const path = require('path');

// 1. App.tsx routes
const appTsx = fs.readFileSync(path.join(__dirname, 'client', 'App.tsx'), 'utf8');
const routeRegex = /<Route\s+path=["']([^"']+)["']\s+element=\{<([^ />]+)/g;
const routes = [];
let match;
while ((match = routeRegex.exec(appTsx)) !== null) {
  routes.push({ path: match[1], component: match[2] });
}
console.log('App.tsx route count:', routes.length);

// 2. Discover all page files
const pagesDir = path.join(__dirname, 'client', 'pages');
function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) results = results.concat(getFiles(full));
    else if (file.endsWith('.tsx')) results.push(full);
  });
  return results;
}
const allPages = getFiles(pagesDir);
console.log('Total page files:', allPages.length);

const compFileMap = {};
allPages.forEach(p => {
  const base = path.basename(p, '.tsx');
  compFileMap[base] = p;
});

// 3. For each route, discover API calls
const matrix = routes.map(r => {
  const filePath = compFileMap[r.component];
  const calls = new Set();
  let flags = [];
  if (filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const apiRegex = /api\.(get|post|put|patch|delete)\((?:`|'|")([^`'"\?]+)/g;
    let m;
    while ((m = apiRegex.exec(content)) !== null) {
      calls.add(m[1].toUpperCase() + ' ' + m[2]);
    }
    // Check for hardcoded mock data flags or empty backend
    if (content.includes('// mock') || content.includes('// Mock') || content.includes('const mock') || content.includes('const MOCK')) {
      flags.push('Contains mock data');
    }
  } else {
    flags.push('Page component not found in client/pages');
  }

  if (calls.size === 0 && !['/', '/login', '/register', '/forgot-password', '/reset-password', '/search', '/booking/confirmation'].includes(r.path)) {
    flags.push('No direct api.* calls');
  }

  return {
    route: r.path,
    component: r.component,
    file: filePath ? path.relative(__dirname, filePath).replace(/\\/g, '/') : 'UNKNOWN',
    apiCalls: Array.from(calls),
    flags
  };
});

fs.writeFileSync(path.join(__dirname, 'matrix_scan.json'), JSON.stringify(matrix, null, 2));
console.log('Wrote matrix_scan.json with', matrix.length, 'entries.');
