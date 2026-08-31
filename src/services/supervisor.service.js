import User from "../models/user.model.js";
import { getNextUid } from "../models/counter.model.js";

export async function getSupervisors({ page, limit, search, status }) {
  const filter = { role: "supervisor" };
  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [{ name: regex }, { email: regex }, { primaryContact: regex }];
  }
  if (status === "active") { filter.tokenVersion = { $gte: 0 }; }
  else if (status === "inactive") { filter.tokenVersion = -1; }
  const skip = (page - 1) * limit;
  const [supervisors, total] = await Promise.all([
    User.find(filter).select("+password").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { data: supervisors, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function createSupervisor({ name, email, primaryContact, password }) {
  const existingEmail = await User.findOne({ email });
  if (existingEmail) return { status: "conflict", reason: "A user with this email already exists" };
  const existingPhone = await User.findOne({ primaryContact });
  if (existingPhone) return { status: "conflict", reason: "A user with this phone number already exists" };
  const uid = await getNextUid();
  const supervisor = await User.create({ uid, name, email, primaryContact, role: "supervisor", password });
  const { password: _, tokenVersion: __, ...supervisorData } = supervisor.toObject();
  return { status: "created", data: supervisorData };
}

export async function getSupervisorById(id) {
  return User.findOne({ _id: id, role: "supervisor" }).select("-password -tokenVersion").lean();
}

export async function updateSupervisorStatus(id, active) {
  const update = active ? { tokenVersion: 0 } : { tokenVersion: -1 };
  return User.findOneAndUpdate({ _id: id, role: "supervisor" }, update, { new: true }).select("-password -tokenVersion");
}

export async function deleteSupervisor(id) {
  return User.findOneAndDelete({ _id: id, role: "supervisor" });
}

export async function updateSupervisor(id, { name, email, primaryContact }) {
  const supervisor = await User.findOne({ _id: id, role: "supervisor" });
  if (!supervisor) return null;
  if (email && email !== supervisor.email) {
    const existing = await User.findOne({ email, _id: { $ne: id } });
    if (existing) return { status: "conflict", reason: "A user with this email already exists" };
  }
  if (primaryContact && primaryContact !== supervisor.primaryContact) {
    const existing = await User.findOne({ primaryContact, _id: { $ne: id } });
    if (existing) return { status: "conflict", reason: "A user with this phone number already exists" };
  }
  const update = {};
  if (name) update.name = name;
  if (email) update.email = email;
  if (primaryContact) update.primaryContact = primaryContact;
  const updated = await User.findOneAndUpdate({ _id: id, role: "supervisor" }, update, { new: true }).select("-password -tokenVersion");
  return { status: "updated", data: updated };
}

export async function changeSupervisorPassword(id, password) {
  const supervisor = await User.findOne({ _id: id, role: "supervisor" });
  if (!supervisor) return null;
  supervisor.password = password;
  await supervisor.save();
  return { status: "updated" };
}

export async function countSupervisors() {
  return User.countDocuments({ role: "supervisor" });
}
