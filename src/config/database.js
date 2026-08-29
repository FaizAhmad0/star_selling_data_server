import mongoose from "mongoose";
import env from "./env.js";

const connectDatabase = async () => {
  const conn = await mongoose.connect(env.MONGODB_URI);
  console.log(`MongoDB connected: ${conn.connection.host}`);
  return conn;
};

const disconnectDatabase = async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed.");
};

export { connectDatabase, disconnectDatabase };
