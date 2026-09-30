import fs from 'fs';
import path from 'path';

const modelsDir = 'c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models';
const files = fs.readdirSync(modelsDir);

const targetModels = [
    'Booking', 'Room', 'Folio', 'Payment', 'AdvancePayment', 'Guest', 
    'HousekeepingTask', 'MaintenanceTicket', 'InventoryItem', 'PurchaseOrder', 
    'RestaurantOrder', 'StockTransaction', 'Vendor', 'CorporateAccount', 
    'GroupBooking', 'Complaint', 'TaskApproval', 'CashierShift', 'BusinessDate', 
    'PaymentChannel', 'RatePlan', 'Coupon', 'AuditLog'
];

for (const file of files) {
  if (!file.endsWith('.ts')) continue;
  
  const modelName = file.replace('.ts', '');
  if (!targetModels.includes(modelName)) continue;
  
  let content = fs.readFileSync(path.join(modelsDir, file), 'utf-8');
  
  // Interface update
  if (content.includes('export interface I') && !content.includes('propertyId:')) {
    content = content.replace(
        /(export interface I[a-zA-Z]+ extends Document {)/,
        '$1\n  propertyId: mongoose.Types.ObjectId;'
    );
  }

  // Schema update
  if (content.includes('new Schema') && !content.includes('propertyId: { type: Schema.Types.ObjectId')) {
    content = content.replace(
        /(new Schema(?:<[^>]+>)?\s*\(\s*\{)/,
        '$1\n    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true },'
    );
  }

  fs.writeFileSync(path.join(modelsDir, file), content);
  console.log(`Updated schema for ${modelName}`);
}

// Special case for User.ts
const userPath = path.join(modelsDir, 'User.ts');
let userContent = fs.readFileSync(userPath, 'utf-8');
if (!userContent.includes('propertyId:')) {
    userContent = userContent.replace(
        /(export interface IUser extends Document {)/,
        '$1\n  propertyId?: mongoose.Types.ObjectId;\n  propertyIds?: mongoose.Types.ObjectId[];'
    );
    userContent = userContent.replace(
        /(new Schema<IUser>\s*\(\s*\{)/,
        '$1\n    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },\n    propertyIds: [{ type: Schema.Types.ObjectId, ref: "Property" }],'
    );
    fs.writeFileSync(userPath, userContent);
    console.log('Updated schema for User');
}
