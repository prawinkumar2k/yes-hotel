import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yes-hotels';

async function inspectDb() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const counts = {};
  for (const coll of ['pageresources', 'roles', 'rolepermissions', 'userpermissionoverrides', 'users', 'properties']) {
    const exists = await db.listCollections({ name: coll }).hasNext();
    if (exists) {
      counts[coll] = await db.collection(coll).countDocuments();
    } else {
      counts[coll] = 0;
    }
  }

  console.log('Database Inspection Counts:');
  console.log(JSON.stringify(counts, null, 2));

  // Duplicates check
  console.log('Checking duplicates...');
  const duplicateKeys = await db.collection('pageresources').aggregate([
    { $group: { _id: "$key", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  console.log('Duplicate PageResource keys:', duplicateKeys);

  const duplicateRoles = await db.collection('roles').aggregate([
    { $group: { _id: "$key", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).toArray();
  console.log('Duplicate Role keys:', duplicateRoles);

  process.exit(0);
}

inspectDb().catch(console.error);
