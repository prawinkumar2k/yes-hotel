const fs = require('fs');
const path = require('path');

// 1. Parse App.tsx imports to map identifier to actual file path
const appTsx = fs.readFileSync(path.join(__dirname, 'client', 'App.tsx'), 'utf8');

const importMap = {};
// standard imports
const standardImportRegex = /import\s+([A-Za-z0-9_]+)\s+from\s+["']([^"']+)["']/g;
let m;
while ((m = standardImportRegex.exec(appTsx)) !== null) {
  importMap[m[1]] = m[2];
}
// lazy imports
const lazyImportRegex = /const\s+([A-Za-z0-9_]+)\s*=\s*lazy\(\(\)\s*=>\s*import\(["']([^"']+)["']\)\)/g;
while ((m = lazyImportRegex.exec(appTsx)) !== null) {
  importMap[m[1]] = m[2];
}

// 2. Parse Routes
const routeRegex = /<Route\s+path=["']([^"']+)["'][^>]*element=\{([^>]+)\}/g;
const routes = [];
while ((m = routeRegex.exec(appTsx)) !== null) {
  const routePath = m[1];
  const elementStr = m[2];
  
  // Find which imported components appear inside elementStr
  let matchedComp = null;
  for (const compName of Object.keys(importMap)) {
    if (new RegExp(`<${compName}[\\s/>]`).test(elementStr)) {
      matchedComp = compName;
      break;
    }
  }

  routes.push({
    route: routePath,
    componentName: matchedComp || 'Navigate/Inline',
    importPath: matchedComp ? importMap[matchedComp] : null
  });
}

console.log('Parsed routes count:', routes.length);

// 3. For each route, resolve actual file and parse all api calls
const matrix = [];

routes.forEach(r => {
  if (!r.importPath) {
    matrix.push({
      route: r.route,
      component: r.componentName,
      file: 'INLINE_OR_REDIRECT',
      apiCalls: [],
      mockFlags: [],
      status: 'REDIRECT_OR_INLINE'
    });
    return;
  }

  // resolve importPath relative to client/
  let resolvedPath = path.resolve(__dirname, 'client', r.importPath);
  if (!fs.existsSync(resolvedPath)) {
    if (fs.existsSync(resolvedPath + '.tsx')) resolvedPath += '.tsx';
    else if (fs.existsSync(resolvedPath + '.ts')) resolvedPath += '.ts';
  }

  if (!fs.existsSync(resolvedPath)) {
    matrix.push({
      route: r.route,
      component: r.componentName,
      file: r.importPath,
      apiCalls: [],
      mockFlags: ['FILE_NOT_FOUND'],
      status: 'MISSING_FILE'
    });
    return;
  }

  const content = fs.readFileSync(resolvedPath, 'utf8');
  const apiCalls = new Set();
  
  // Match api.get, api.post, etc.
  const apiCallRegex = /api\.(get|post|put|patch|delete)\(\s*(?:`|'|")([^`'"\?]+)/g;
  let cm;
  while ((cm = apiCallRegex.exec(content)) !== null) {
    apiCalls.add(cm[1].toUpperCase() + ' ' + cm[2].trim());
  }

  // Match fetch calls
  const fetchRegex = /fetch\(\s*(?:`|'|")([^`'"\?]+)/g;
  while ((cm = fetchRegex.exec(content)) !== null) {
    if (cm[1].startsWith('/api')) {
      apiCalls.add('FETCH ' + cm[1].trim());
    }
  }

  const mockFlags = [];
  if (content.includes('// mock') || content.includes('// Mock') || content.includes('const mock') || content.includes('const MOCK')) {
    mockFlags.push('MOCK_COMMENT_OR_VARIABLE');
  }

  matrix.push({
    route: r.route,
    component: r.componentName,
    file: path.relative(__dirname, resolvedPath).replace(/\\/g, '/'),
    apiCalls: Array.from(apiCalls),
    mockFlags,
    status: apiCalls.size > 0 ? 'CONNECTED' : (r.route.startsWith('/terms') || r.route === '/' ? 'STATIC_OR_CMS' : 'NO_DIRECT_API')
  });
});

fs.writeFileSync(path.join(__dirname, 'precise_matrix.json'), JSON.stringify(matrix, null, 2));
console.log('Saved precise_matrix.json with', matrix.length, 'routes.');
