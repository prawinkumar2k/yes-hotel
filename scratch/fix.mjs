import fs from 'fs';
import path from 'path';

const modelsDir = 'c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models';

function fixFile(file, lineRegex) {
    const p = path.join(modelsDir, file);
    let content = fs.readFileSync(p, 'utf-8');
    const lines = content.split('\n');
    let deleteNext = false;
    const res = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(lineRegex)) {
            res.push(lines[i]);
            deleteNext = true;
        } else if (deleteNext && lines[i].includes('propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true }')) {
            deleteNext = false; // skip this line
        } else {
            res.push(lines[i]);
        }
    }
    fs.writeFileSync(p, res.join('\n'));
}

fixFile('GroupBooking.ts', /const GroupRoomBlockSchema = new Schema/);
fixFile('RestaurantOrder.ts', /const OrderItemSchema = new Schema/);
