// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import User from "../models/user.model.js";
// import Platform from "../models/platform.model.js";

// dotenv.config();

// const PLATFORM_NAME_MAP = {
//   amazon: "Amazon",
//   website: "Website",
//   etsy: "Etsy",
// };

// async function migrate() {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI);
//     console.log("Connected to MongoDB");

//     const platformDocs = await Platform.find({}).lean();
//     const platformLookup = {};
//     for (const doc of platformDocs) {
//       platformLookup[doc.name.toLowerCase()] = doc._id;
//     }
//     console.log("Platform lookup:", platformLookup);

//     const users = await User.find({ role: "user" }).lean();
//     console.log(`Found ${users.length} users`);

//     let updated = 0;
//     let skipped = 0;

//     for (const user of users) {
//       const platformIds = [];

//       if (user.enrollmentIdAmazon && platformLookup.amazon) {
//         platformIds.push(platformLookup.amazon);
//       }
//       if (user.enrollmentIdWebsite && platformLookup.website) {
//         platformIds.push(platformLookup.website);
//       }
//       if (user.enrollmentIdEtsy && platformLookup.etsy) {
//         platformIds.push(platformLookup.etsy);
//       }

//       if (platformIds.length === 0) {
//         skipped++;
//         continue;
//       }

//       const existingIds = (user.platforms || []).map((id) => id.toString());
//       const newIds = platformIds.filter((id) => !existingIds.includes(id.toString()));

//       if (newIds.length === 0) {
//         skipped++;
//         continue;
//       }

//       await User.updateOne(
//         { _id: user._id },
//         { $addToSet: { platforms: { $each: newIds } } }
//       );
//       updated++;
//     }

//     console.log(`Migration complete: ${updated} updated, ${skipped} skipped`);
//   } catch (error) {
//     console.error("Migration failed:", error);
//   } finally {
//     await mongoose.disconnect();
//     console.log("Disconnected from MongoDB");
//   }
// }

// migrate();
