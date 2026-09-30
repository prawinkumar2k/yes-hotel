const fs = require('fs');
const path = require('path');

const clientPagesDir = path.join(__dirname, '../client/pages');
const serverRoutesDir = path.join(__dirname, '../server/src/routes');
const serverControllersDir = path.join(__dirname, '../server/src/controllers');
const docsDir = path.join(__dirname, '../docs');

function getFiles(dir, ext) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules')) {
      results = results.concat(getFiles(file, ext));
    } else if (file.endsWith(ext)) {
      results.push(file);
    }
  });
  return results;
}

// Map endpoints to controllers
const routesFiles = getFiles(serverRoutesDir, '.ts');
const routeMap = []; // { method, path, controller }
routesFiles.forEach(rf => {
  const content = fs.readFileSync(rf, 'utf8');
  const lines = content.split('\n');
  lines.forEach(line => {
    // looking for router.get('/path', ..., controllerName)
    const match = line.match(/router\.(get|post|put|patch|delete)\(\s*['"`](.*?)['"`]/);
    if (match) {
      const method = match[1].toUpperCase();
      const endpointPath = match[2];
      // extract controller roughly by getting the last word
      const parts = line.split(',');
      const lastPart = parts[parts.length - 1].replace(/\);?/, '').trim();
      routeMap.push({ method, path: endpointPath, controller: lastPart, file: path.basename(rf) });
    }
  });
});

// Map controllers to models
const controllerFiles = getFiles(serverControllersDir, '.ts');
const controllerModelsMap = {}; // { controllerName: [models] }
controllerFiles.forEach(cf => {
  const content = fs.readFileSync(cf, 'utf8');
  // crude parsing: find exported functions, then see what capitalized words (models) are used inside
  const funcs = content.split(/export const /);
  funcs.slice(1).forEach(funcBlock => {
    const funcName = funcBlock.split('=')[0].trim();
    // extract mongoose models used, e.g. Booking.find, Folio.create
    const modelMatches = funcBlock.match(/\b([A-Z][a-zA-Z0-9_]*)\.(find|findOne|create|findById|update|aggregate|delete)/g) || [];
    const models = [...new Set(modelMatches.map(m => m.split('.')[0]))];
    controllerModelsMap[funcName] = models;
  });
});

// Map pages to APIs
const pageFiles = getFiles(clientPagesDir, '.tsx');
const pageMap = [];
pageFiles.forEach(pf => {
  const content = fs.readFileSync(pf, 'utf8');
  const pageName = path.basename(pf, '.tsx');
  // Match fetch(`/api/...`) or api.get(`/...`)
  const apiMatches = content.match(/(fetch|api\.(get|post|put|patch|delete))\([\s\S]*?['"`]\/?(api\/)?(.*?)['"`]/g) || [];
  const uniqueApis = [...new Set(apiMatches)];
  
  uniqueApis.forEach(apiCall => {
    const isFetch = apiCall.startsWith('fetch');
    let method = 'GET';
    if (!isFetch) {
      const mMatch = apiCall.match(/api\.(get|post|put|patch|delete)/);
      if (mMatch) method = mMatch[1].toUpperCase();
    } else {
      // rough guess for fetch method
      if (content.includes('method: "POST"')) method = 'POST';
      else if (content.includes('method: "PUT"')) method = 'PUT';
      else if (content.includes('method: "PATCH"')) method = 'PATCH';
      else if (content.includes('method: "DELETE"')) method = 'DELETE';
    }
    
    // Extract endpoint path
    const pathMatch = apiCall.match(/['"`]\/?(api\/)?(.*?)['"`]/);
    const endpointStr = pathMatch ? '/' + pathMatch[2].split('?')[0].replace(/\$\{[^}]+\}/g, ':id') : '';

    // match against route map
    let models = [];
    routeMap.forEach(r => {
      if (endpointStr.includes(r.path.replace(':id', ''))) {
        if (controllerModelsMap[r.controller]) {
          models = [...new Set([...models, ...controllerModelsMap[r.controller]])];
        }
      }
    });

    pageMap.push({
      page: pageName,
      method,
      api: endpointStr,
      models: models.join(', ') || 'Unknown'
    });
  });
});

let mdContent = `# PAGE → API → DATABASE MATRIX\n\n| Page | Method | API | Database Models | Status |\n|------|--------|-----|-----------------|--------|\n`;
pageMap.forEach(p => {
  mdContent += `| ${p.page} | ${p.method} | ${p.api} | ${p.models} | NOT VERIFIED |\n`;
});

fs.writeFileSync(path.join(docsDir, 'PAGE_API_DATABASE_MATRIX.md'), mdContent);
console.log('Matrix generated.');
