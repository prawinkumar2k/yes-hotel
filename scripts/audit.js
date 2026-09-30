const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '../client');
const serverDir = path.join(__dirname, '../server/src');
const docsDir = path.join(__dirname, '../docs');

if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir);
}

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

const clientFiles = getFiles(clientDir, '.tsx');
const routeFiles = getFiles(path.join(serverDir, 'routes'), '.ts');
const modelFiles = getFiles(path.join(serverDir, 'models'), '.ts');

let fullSystemXray = `# FULL SYSTEM X-RAY\n\n## 1. FRONTEND PAGES\n`;
clientFiles.forEach(f => {
  fullSystemXray += `- ${path.basename(f)}\n`;
});

fullSystemXray += `\n## 2. DATABASE MODELS\n`;
modelFiles.forEach(f => {
  fullSystemXray += `- ${path.basename(f)}\n`;
});

fullSystemXray += `\n## 3. API ROUTES\n`;
routeFiles.forEach(f => {
  fullSystemXray += `- ${path.basename(f)}\n`;
});

fs.writeFileSync(path.join(docsDir, 'FULL_SYSTEM_XRAY.md'), fullSystemXray);
console.log('Initial FULL_SYSTEM_XRAY.md generated.');
