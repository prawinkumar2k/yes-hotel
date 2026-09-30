import fs from 'fs';
import path from 'path';

const modelsDir = 'c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models';
const files = fs.readdirSync(modelsDir);

let md = '# PROPERTY OWNERSHIP MATRIX\n\n';
md += '| Model Name | Collection | Property Field | Required? | Parent Model | Direct Storage Req? | Inherited Acceptable? | Notes |\n';
md += '|---|---|---|---|---|---|---|---|\n';

for (const file of files) {
  if (!file.endsWith('.ts')) continue;
  const content = fs.readFileSync(path.join(modelsDir, file), 'utf-8');
  
  const modelNameMatch = content.match(/model(?:<[^>]+>)?\s*\(\s*['"]([^'"]+)['"]/);
  const modelName = modelNameMatch ? modelNameMatch[1] : file.replace('.ts', '');
  
  let propertyField = 'None';
  let required = 'N/A';
  
  if (content.includes('propertyId:')) {
    propertyField = 'propertyId';
    if (content.includes('propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true }') || content.match(/propertyId:\s*\{\s*type:\s*Schema\.Types\.ObjectId,\s*ref:\s*['"]Property['"],\s*required:\s*true/)) {
        required = 'Yes';
    } else {
        required = 'No';
    }
  } else if (content.includes('property:')) {
    propertyField = 'property';
  }
  
  let parent = 'None';
  if (content.includes('folioId:')) parent = 'Folio';
  else if (content.includes('bookingId:')) parent = 'Booking';
  else if (content.includes('roomId:')) parent = 'Room';
  else if (content.includes('guestId:')) parent = 'Guest';
  else if (content.includes('userId:')) parent = 'User';

  let directStorage = 'TBD';
  let inheritedAcceptable = 'TBD';

  const directlyOwned = ['Booking', 'Room', 'Folio', 'Payment', 'AdvancePayment', 'Guest', 'User', 'InventoryItem', 'PurchaseOrder', 'RestaurantOrder', 'HousekeepingTask', 'MaintenanceTicket'];
  
  if (directlyOwned.includes(modelName)) {
      directStorage = 'Yes';
      inheritedAcceptable = 'No';
  } else if (parent !== 'None') {
      directStorage = 'No';
      inheritedAcceptable = 'Yes';
  } else {
      directStorage = 'Yes';
      inheritedAcceptable = 'No';
  }

  md += `| ${modelName} | ${modelName.toLowerCase()}s | ${propertyField} | ${required} | ${parent} | ${directStorage} | ${inheritedAcceptable} | |\n`;
}

fs.writeFileSync('c:/Users/Hp/Downloads/yes-hotels-booking-b40/docs/PROPERTY_OWNERSHIP_MATRIX.md', md);
console.log('Matrix updated');
