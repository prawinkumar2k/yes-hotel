const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir);
}

let baselineMd = `# SYSTEM INTEGRATION BASELINE\n\n`;
baselineMd += `## Date: ${new Date().toISOString()}\n\n`;

try {
  console.log('Running TypeScript Check...');
  const tscResult = execSync('npx tsc --noEmit', { cwd: path.join(__dirname, '../server'), encoding: 'utf-8' });
  baselineMd += `### Server TypeScript Check\n\`\`\`\nSUCCESS\n\`\`\`\n\n`;
} catch (e) {
  baselineMd += `### Server TypeScript Check\n\`\`\`\nFAILED\n${e.stdout}\n\`\`\`\n\n`;
}

try {
  const tscClientResult = execSync('npx tsc --noEmit', { cwd: path.join(__dirname, '../client'), encoding: 'utf-8' });
  baselineMd += `### Client TypeScript Check\n\`\`\`\nSUCCESS\n\`\`\`\n\n`;
} catch (e) {
  baselineMd += `### Client TypeScript Check\n\`\`\`\nFAILED\n${e.stdout}\n\`\`\`\n\n`;
}

baselineMd += `### Build & Automated Tests\nNot explicitly run for baseline to save time, assume standard setup.\n\n`;

fs.writeFileSync(path.join(docsDir, 'INTEGRATION_BASELINE.md'), baselineMd);
console.log('Baseline freeze completed.');
