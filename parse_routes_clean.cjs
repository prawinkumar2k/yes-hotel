const fs = require('fs');
const path = require('path');

const appTsx = fs.readFileSync(path.join(__dirname, 'client', 'App.tsx'), 'utf8');

// 1. Map component names to import paths
const importMap = {};
const lines = appTsx.split('\n');
lines.forEach(line => {
  const stdMatch = line.match(/import\s+([A-Za-z0-9_]+)\s+from\s+["']([^"']+)["']/);
  if (stdMatch) importMap[stdMatch[1]] = stdMatch[2];
  const lazyMatch = line.match(/const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\(["']([^"']+)["']\)\)/);
  if (lazyMatch) importMap[lazyMatch[1]] = lazyMatch[2];
});

// Ignore wrapper components
const wrappers = new Set(['ProtectedRoute', 'PermissionRoute', 'AdminLayout', 'Suspense', 'Navigate']);

// 2. Line by line route parsing
const matrix = [];
lines.forEach(line => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('<Route')) return;

  const pathMatch = trimmed.match(/path=["']([^"']+)["']/);
  const routePath = pathMatch ? pathMatch[1] : null;
  if (!routePath) return;

  // Find actual page components referenced in this line (skipping wrappers)
  let foundComp = null;
  for (const comp of Object.keys(importMap)) {
    if (wrappers.has(comp)) continue;
    if (new RegExp(`<${comp}[\\s/>]`).test(trimmed)) {
      foundComp = comp;
      break;
    }
  }

  const importPath = foundComp ? importMap[foundComp] : null;
  let filePath = null;
  let apiCalls = new Set();
  let mockFlags = [];

  if (importPath) {
    let resolved = path.resolve(__dirname, 'client', importPath);
    if (!fs.existsSync(resolved)) {
      if (fs.existsSync(resolved + '.tsx')) resolved += '.tsx';
      else if (fs.existsSync(resolved + '.ts')) resolved += '.ts';
    }
    if (fs.existsSync(resolved)) {
      filePath = path.relative(__dirname, resolved).replace(/\\/g, '/');
      const content = fs.readFileSync(resolved, 'utf8');
      
      const apiRegex = /api\.(get|post|put|patch|delete)\(\s*(?:`|'|")([^`'"\?]+)/g;
      let am;
      while ((am = apiRegex.exec(content)) !== null) {
        apiCalls.add(am[1].toUpperCase() + ' ' + am[2].trim());
      }
      const fetchRegex = /fetch\(\s*(?:`|'|")([^`'"\?]+)/g;
      while ((am = fetchRegex.exec(content)) !== null) {
        if (am[1].startsWith('/api')) {
          apiCalls.add('FETCH ' + am[1].trim());
        }
      }

      if (content.includes('// mock') || content.includes('// Mock') || content.includes('const mock') || content.includes('const MOCK')) {
        mockFlags.push('MOCK_VARS');
      }
    } else {
      filePath = 'FILE_NOT_FOUND: ' + importPath;
    }
  }

  matrix.push({
    route: routePath,
    component: foundComp || 'Inline/Redirect',
    file: filePath || 'N/A',
    apiCalls: Array.from(apiCalls),
    mockFlags,
    status: apiCalls.size > 0 ? 'CONNECTED' : (filePath ? 'STATIC_OR_SUBCOMPONENTS' : 'REDIRECT')
  });
});

fs.writeFileSync(path.join(__dirname, 'matrix_results_clean.json'), JSON.stringify(matrix, null, 2));
console.log('Clean matrix saved with', matrix.length, 'entries.');
