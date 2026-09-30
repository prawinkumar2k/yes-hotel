const mongoose = require('mongoose');

async function initMongo() {
  try {
    const conn = await mongoose.createConnection('mongodb://127.0.0.1:27027/admin').asPromise();
    const admin = conn.db;
    console.log("Checking replica set status...");
    try {
      await admin.command({ replSetGetStatus: 1 });
      console.log("Replica set already initialized.");
    } catch (e) {
      if (e.message.includes('no replset config has been received') || e.message.includes('not yet initialized')) {
        console.log("Initializing replica set...");
        await admin.command({ replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27027" }] } });
        console.log("Replica set initialized successfully.");
      } else {
        console.error("Error checking replSet status:", e.message);
      }
    }
    await conn.close();
  } catch (e) {
    console.error("Connection error:", e.message);
  }
}

initMongo();
