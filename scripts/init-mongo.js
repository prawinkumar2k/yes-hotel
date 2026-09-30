const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

async function initMongo() {
  const url = 'mongodb://127.0.0.1:27027';
  const client = new MongoClient(url);
  try {
    await client.connect();
    const admin = client.db('admin');
    console.log("Checking replica set status...");
    try {
      const status = await admin.command({ replSetGetStatus: 1 });
      console.log("Replica set already initialized.");
    } catch (e) {
      if (e.message.includes('no replset config has been received')) {
        console.log("Initializing replica set...");
        await admin.command({ replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27027" }] } });
        console.log("Replica set initialized successfully.");
      } else {
        console.error("Error checking replSet status:", e.message);
      }
    }
  } catch (e) {
    console.error("Connection error:", e.message);
  } finally {
    await client.close();
  }
}

initMongo();
