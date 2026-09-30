import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yes-hotels';

async function runMigration() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // 1. Identify or create default property
  const db = mongoose.connection.db;
  const propertiesCollection = db.collection('properties');
  
  let defaultProperty = await propertiesCollection.findOne({ code: 'YES-HYD' });
  if (!defaultProperty) {
    console.log('Default property not found. Creating YES HOTELS HYDERABAD...');
    const res = await propertiesCollection.insertOne({
      name: 'YES HOTELS HYDERABAD',
      code: 'YES-HYD',
      addressLine1: 'Hitech City',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500081',
      country: 'India',
      phone: '1234567890',
      email: 'hyd@yeshotels.com',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    defaultProperty = { _id: res.insertedId };
  }
  
  const propertyId = defaultProperty._id;
  console.log(`Using Property ID: ${propertyId}`);

  // Collections to migrate
  const collections = [
    'users', 'bookings', 'rooms', 'folios', 'advancepayments', 'payments',
    'guests', 'housekeepingtasks', 'maintenancetickets', 'inventoryitems',
    'purchaseorders', 'restaurantorders'
  ];

  console.log('\n--- MIGRATION COUNTS ---');

  for (const collName of collections) {
    const collection = db.collection(collName);
    
    // Check if collection exists
    const collExists = await db.listCollections({ name: collName }).hasNext();
    if (!collExists) {
        console.log(`${collName}: Collection does not exist. Skipping.`);
        continue;
    }

    const totalCount = await collection.countDocuments();
    const unassignedCount = await collection.countDocuments({ 
        $or: [ { propertyId: { $exists: false } }, { propertyId: null } ]
    });

    console.log(`\nCollection: ${collName}`);
    console.log(`Before: ${totalCount}`);
    
    // Perform update
    if (unassignedCount > 0) {
      await collection.updateMany(
        { $or: [ { propertyId: { $exists: false } }, { propertyId: null } ] },
        { $set: { propertyId: propertyId } }
      );
    }
    
    const afterCount = await collection.countDocuments();
    const afterUnassignedCount = await collection.countDocuments({ 
        $or: [ { propertyId: { $exists: false } }, { propertyId: null } ]
    });

    console.log(`After property assignment: ${afterCount}`);
    console.log(`Unassigned: ${afterUnassignedCount}`);
  }

  console.log('\nMigration complete.');
  await mongoose.disconnect();
}

runMigration().catch(console.error);
