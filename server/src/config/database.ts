import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    // NOTE: directConnection=true was tried here and reverted — it broke
    // multi-document transactions outright ("This MongoDB deployment does
    // not support retryable writes"), which booking-safety.service.ts
    // depends on for correctness. The plain connection string below (no
    // directConnection) is what actually works against this project's
    // local single-node replica set and must stay this way.
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels";
    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    conn.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err.message);
    });
    conn.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected — /api/ready will report not-ready until it reconnects.");
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};
