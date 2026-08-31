import User from "../models/user.model.js";
import { getNextUid } from "../models/counter.model.js";

export async function getManagers({ page, limit, search, status }) {
  const filter = { role: "manager" };

  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [
      { name: regex },
      { email: regex },
      { primaryContact: regex },
    ];
  }

  if (status === "active") {
    filter.tokenVersion = { $gte: 0 };
  } else if (status === "inactive") {
    filter.tokenVersion = -1;
  }

  const skip = (page - 1) * limit;

  const [managers, total] = await Promise.all([
    User.find(filter)
      .select("+password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    data: managers,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createManager({ name, email, primaryContact, password }) {
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    return { status: "conflict", reason: "A user with this email already exists" };
  }

  const existingPhone = await User.findOne({ primaryContact });
  if (existingPhone) {
    return { status: "conflict", reason: "A user with this phone number already exists" };
  }

  const uid = await getNextUid();

  const manager = await User.create({
    uid,
    name,
    email,
    primaryContact,
    role: "manager",
    password,
  });

  const { password: _, tokenVersion: __, ...managerData } = manager.toObject();

  return { status: "created", data: managerData };
}

export async function getManagerById(id) {
  const manager = await User.findOne({ _id: id, role: "manager" })
    .select("-password -tokenVersion")
    .lean();

  return manager;
}

export async function updateManagerStatus(id, active) {
  const update = active ? { tokenVersion: 0 } : { tokenVersion: -1 };
  const manager = await User.findOneAndUpdate(
    { _id: id, role: "manager" },
    update,
    { new: true }
  ).select("-password -tokenVersion");

  return manager;
}

export async function deleteManager(id) {
  const manager = await User.findOneAndDelete({ _id: id, role: "manager" });
  return manager;
}

export async function updateManager(id, { name, email, primaryContact }) {
  const manager = await User.findOne({ _id: id, role: "manager" });
  if (!manager) return null;

  if (email && email !== manager.email) {
    const existing = await User.findOne({ email, _id: { $ne: id } });
    if (existing) {
      return { status: "conflict", reason: "A user with this email already exists" };
    }
  }

  if (primaryContact && primaryContact !== manager.primaryContact) {
    const existing = await User.findOne({ primaryContact, _id: { $ne: id } });
    if (existing) {
      return { status: "conflict", reason: "A user with this phone number already exists" };
    }
  }

  const update = {};
  if (name) update.name = name;
  if (email) update.email = email;
  if (primaryContact) update.primaryContact = primaryContact;

  const updated = await User.findOneAndUpdate(
    { _id: id, role: "manager" },
    update,
    { new: true }
  ).select("-password -tokenVersion");

  return { status: "updated", data: updated };
}

export async function changeManagerPassword(id, password) {
  const manager = await User.findOne({ _id: id, role: "manager" });
  if (!manager) return null;

  manager.password = password;
  await manager.save();

  return { status: "updated" };
}

export async function countManagers() {
  return User.countDocuments({ role: "manager" });
}
