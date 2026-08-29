import bcrypt from "bcryptjs";
import User from "../models/user.model.js";

const PLATFORM_MAP = {
  AZ: "amazon",
  AM: "amazon",
  WB: "website",
  ET: "etsy",
};

function detectPlatform(enrollment) {
  const prefix = enrollment.slice(0, 2).toUpperCase();
  return PLATFORM_MAP[prefix] || null;
}

function buildFieldName(platform, field) {
  const suffix = platform.charAt(0).toUpperCase() + platform.slice(1);
  return `${field}${suffix}`;
}

function generatePassword(uid, name, primaryContact) {
  const uidStr = String(uid);
  const namePrefix = name.slice(0, 2).toUpperCase();
  const mobileSuffix = primaryContact.slice(-2).toUpperCase();
  const raw = `UID${uidStr}@${namePrefix}@${mobileSuffix}`;
  return raw.toUpperCase();
}

function stripPassword(user) {
  const obj = user.toObject();
  delete obj.password;
  return obj;
}

async function resolveManager(managerName, managerCache) {
  if (managerCache && managerCache.has(managerName)) {
    return managerCache.get(managerName);
  }

  const manager = await User.findOne({ name: managerName, role: "manager" }).select("_id name role");

  if (!manager) {
    throw new Error(`${managerName} is not defined as a manager.`);
  }

  if (managerCache) {
    managerCache.set(managerName, manager);
  }

  return manager;
}

async function getNextUid(managerCache) {
  if (managerCache && managerCache._nextUid !== undefined) {
    return managerCache._nextUid;
  }

  const lastUser = await User.findOne().sort({ uid: -1 }).select("uid").lean();
  const nextUid = lastUser ? lastUser.uid + 1 : 1;

  if (managerCache) {
    managerCache._nextUid = nextUid;
  }

  return nextUid;
}

function incrementNextUid(managerCache) {
  if (managerCache && managerCache._nextUid !== undefined) {
    managerCache._nextUid += 1;
  }
}

async function processUser(userData, managerCache) {
  const { name, email, enrollment, primaryContact, date, batch, manager, enrolledBy } = userData;

  const platform = detectPlatform(enrollment);
  if (!platform) {
    return { status: "skipped", reason: `Unsupported enrollment prefix: ${enrollment.slice(0, 2).toUpperCase()}` };
  }

  let managerUser;
  try {
    managerUser = await resolveManager(manager, managerCache);
  } catch (err) {
    return { status: "skipped", reason: err.message };
  }

  const existingUser = await User.findOne({ primaryContact });

  if (existingUser) {
    const enrollmentField = buildFieldName(platform, "enrollmentId");
    if (existingUser[enrollmentField]) {
      return { status: "skipped", reason: "Enrollment already exists for this contact." };
    }

    const managerField = buildFieldName(platform, "Manager");
    const batchField = buildFieldName(platform, "batch");
    const dateField = buildFieldName(platform, "date");

    existingUser[enrollmentField] = enrollment;
    existingUser[managerField] = managerUser._id;
    existingUser[batchField] = batch;
    existingUser[dateField] = date;

    await existingUser.save();
    return { status: "updated", user: stripPassword(existingUser) };
  }

  const uid = await getNextUid(managerCache);
  const plainPassword = generatePassword(uid, name, primaryContact);
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const newUserData = {
    uid,
    name,
    email,
    primaryContact,
    password: hashedPassword,
    enrolledBy,
    role: "user",
  };

  const enrollmentField = buildFieldName(platform, "enrollmentId");
  const managerField = buildFieldName(platform, "Manager");
  const batchField = buildFieldName(platform, "batch");
  const dateField = buildFieldName(platform, "date");

  newUserData[enrollmentField] = enrollment;
  newUserData[managerField] = managerUser._id;
  newUserData[batchField] = batch;
  newUserData[dateField] = date;

  const newUser = await User.create(newUserData);
  incrementNextUid(managerCache);

  return { status: "created", user: stripPassword(newUser) };
}

export async function createUser(userData) {
  const result = await processUser(userData, null);
  return result;
}

export async function bulkCreateUsers(usersData) {
  const managerCache = new Map();
  managerCache._nextUid = undefined;

  const created = [];
  const updated = [];
  const skipped = [];

  for (const userData of usersData) {
    const result = await processUser(userData, managerCache);

    if (result.status === "created") {
      created.push(result.user);
    } else if (result.status === "updated") {
      updated.push(result.user);
    } else {
      skipped.push({
        enrollment: userData.enrollment,
        primaryContact: userData.primaryContact,
        reason: result.reason,
      });
    }
  }

  return { created, updated, skipped };
}
