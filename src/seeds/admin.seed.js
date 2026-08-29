import mongoose from "mongoose";
import env from "../config/env.js";
import User from "../models/user.model.js";

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("MongoDB connected for seeding.");

  const existing = await User.findOne({ uid: 1 });
  if (existing) {
    console.log("Admin user with UID 1 already exists. Skipping.");
    await mongoose.connection.close();
    return;
  }

  await User.create({
    uid: 1,
    name: "Admin",
    email: "admin@starselling.com",
    primaryContact: "0000000000",
    password: "Admin",
    role: "admin",
  });

  console.log("Admin user seeded successfully.");
  await mongoose.connection.close();
}

seed().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
