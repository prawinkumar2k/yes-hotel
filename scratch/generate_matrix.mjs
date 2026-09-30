import fs from 'fs';
import path from 'path';

const modelsDir = 'c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models';
const files = fs.readdirSync(modelsDir);

let md = '# PROPERTY OWNERSHIP MATRIX\n\n';
md += '| Model Name | Property Field | Required? | Parent Model | Notes |\n';
md += '|---|---|---|---|---|\n';

for (const file of files) {
  if (!file.endsWith('.ts')) continue;
  const content = fs.readFileSync(path.join(modelsDir, file), 'utf-8');
  
  const modelNameMatch = content.match(/model(?:<[^>]+>)?\s*\(\s*['"]([^'"]+)['"]/);
  const modelName = modelNameMatch ? modelNameMatch[1] : file.replace('.ts', '');
  
  const hasPropertyId = content.includes('propertyId');
  const hasProperty = content.includes('property:');
  
  let field = 'None';
  let required = 'N/A';
  
  if (hasPropertyId) field = 'propertyId';
  else if (hasProperty) field = 'property';
  
  if (field !== 'None') {
    const fieldMatch = new RegExp(`${field}:\\s*{[^}]*required:\\s*(true|false)`);
    const match = content.match(fieldMatch);
    if (match) required = match[1];
    else if (content.includes(`${field}: { type: Schema.Types.ObjectId`)) required = 'Check';
  }
  
  let parent = 'None';
  if (content.includes('folioId')) parent = 'Folio';
  else if (content.includes('bookingId')) parent = 'Booking';
  else if (content.includes('roomId')) parent = 'Room';
  
  md += `| ${modelName} | ${field} | ${required} | ${parent} | |\n`;
}

fs.writeFileSync('c:/Users/Hp/Downloads/yes-hotels-booking-b40/docs/PROPERTY_OWNERSHIP_MATRIX.md', md);
console.log('Matrix generated');
