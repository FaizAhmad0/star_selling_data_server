import User from "../models/user.model.js";
import Platform from "../models/platform.model.js";
import { getNextUid } from "../models/counter.model.js";

const PLATFORM_MAP = {
  AZ: "amazon",
  AM: "amazon",
  WB: "website",
  ET: "etsy",
};

const PLATFORM_NAME_MAP = {
  amazon: "Amazon",
  website: "Website",
  etsy: "Etsy",
};

function detectPlatform(enrollment) {
  const prefix = enrollment.slice(0, 2).toUpperCase();
  return PLATFORM_MAP[prefix] || null;
}

async function resolvePlatformIds(platformKey) {
  const platformName = PLATFORM_NAME_MAP[platformKey];
  if (!platformName) return [];
  const platform = await Platform.findOne({ name: platformName, status: "active" }).select("_id");
  return platform ? [platform._id] : [];
}

const FIELD_MAP = {
  amazon: {
    enrollmentId: "enrollmentIdAmazon",
    Manager: "amazonManager",
    batch: "batchAmazon",
    date: "dateAmazon",
  },
  website: {
    enrollmentId: "enrollmentIdWebsite",
    Manager: "websiteManager",
    batch: "batchWebsite",
    date: "dateWebsite",
  },
  etsy: {
    enrollmentId: "enrollmentIdEtsy",
    Manager: "etsyManager",
    batch: "batchEtsy",
    date: "dateEtsy",
  },
};

function buildFieldName(platform, field) {
  return FIELD_MAP[platform]?.[field] ?? `${field}${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
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

  const platformIds = await resolvePlatformIds(platform);

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

    if (platformIds.length > 0) {
      const existingPlatformIds = (existingUser.platforms || []).map((id) => id.toString());
      const newIds = platformIds.filter((id) => !existingPlatformIds.includes(id.toString()));
      if (newIds.length > 0) {
        existingUser.platforms = [...(existingUser.platforms || []), ...newIds];
      }
    }

    await existingUser.save();
    return { status: "updated", user: stripPassword(existingUser) };
  }

  const uid = await getNextUid();
  const plainPassword = generatePassword(uid, name, primaryContact);

  const newUserData = {
    uid,
    name,
    email,
    primaryContact,
    password: plainPassword,
    enrolledBy,
    role: "user",
    platforms: platformIds,
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

  return { status: "created", user: stripPassword(newUser) };
}

export async function getUsers({ page, limit, search, manager, batch, status, joiningDate }) {
  const filter = { role: "user" };

  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [
      { name: regex },
      { email: regex },
      { primaryContact: regex },
      { enrollmentIdAmazon: regex },
      { enrollmentIdWebsite: regex },
      { enrollmentIdEtsy: regex },
    ];
  }

  if (manager) {
    const managerDocs = await User.find({ name: new RegExp(manager, "i"), role: "manager" }).select("_id");
    const managerIds = managerDocs.map((m) => m._id);
    if (managerIds.length > 0) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { amazonManager: { $in: managerIds } },
          { websiteManager: { $in: managerIds } },
          { etsyManager: { $in: managerIds } },
        ],
      });
    } else {
      filter.$and = filter.$and || [];
      filter.$and.push({ _id: { $in: [] } });
    }
  }

  if (batch) {
    const batchRegex = new RegExp(batch, "i");
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { batchAmazon: batchRegex },
        { batchWebsite: batchRegex },
        { batchEtsy: batchRegex },
      ],
    });
  }

  if (status === "active") {
    filter.tokenVersion = { $gte: 0 };
  } else if (status === "inactive") {
    filter.tokenVersion = -1;
  }

  if (joiningDate) {
    const dateRegex = new RegExp(joiningDate, "i");
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { dateAmazon: dateRegex },
        { dateWebsite: dateRegex },
        { dateEtsy: dateRegex },
      ],
    });
  }

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("amazonManager", "name email")
      .populate("websiteManager", "name email")
      .populate("etsyManager", "name email")
      .populate("platforms", "name status")
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    data: users,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createUser(userData) {
  const result = await processUser(userData, null);
  return result;
}

export async function deleteUser(id) {
  const user = await User.findOneAndDelete({ _id: id, role: "user" });
  return user;
}

export async function updateUser(id, { name, email, primaryContact, platforms }) {
  const user = await User.findOne({ _id: id, role: "user" });
  if (!user) return null;

  if (email && email !== user.email) {
    const existing = await User.findOne({ email, _id: { $ne: id } });
    if (existing) return { status: "conflict", reason: "A user with this email already exists" };
  }

  if (primaryContact && primaryContact !== user.primaryContact) {
    const existing = await User.findOne({ primaryContact, _id: { $ne: id } });
    if (existing) return { status: "conflict", reason: "A user with this phone number already exists" };
  }

  const update = {};
  if (name) update.name = name;
  if (email) update.email = email;
  if (primaryContact) update.primaryContact = primaryContact;
  if (platforms !== undefined) update.platforms = platforms;

  const updated = await User.findOneAndUpdate(
    { _id: id, role: "user" },
    update,
    { new: true }
  )
    .select("-password -tokenVersion")
    .populate("platforms", "name status");

  return { status: "updated", data: updated };
}

export async function bulkCreateUsers(usersData) {
  const managerCache = new Map();

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
