import Platform from "../models/platform.model.js";

export async function getPlatforms({ page, limit, search, status }) {
  const filter = {};

  if (search) {
    const regex = new RegExp(search, "i");
    filter.name = regex;
  }

  if (status) {
    filter.status = status;
  }

  const skip = (page - 1) * limit;

  const [platforms, total] = await Promise.all([
    Platform.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Platform.countDocuments(filter),
  ]);

  return {
    data: platforms,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPlatformById(id) {
  const platform = await Platform.findById(id).lean();
  return platform;
}

export async function createPlatform({ name, status }) {
  const existing = await Platform.findOne({ name });
  if (existing) {
    return { status: "conflict", reason: "A platform with this name already exists" };
  }

  const platform = await Platform.create({ name, status: status || "active" });

  return { status: "created", data: platform.toObject() };
}

export async function updatePlatform(id, { name, status }) {
  const platform = await Platform.findById(id);
  if (!platform) return null;

  if (name && name !== platform.name) {
    const existing = await Platform.findOne({ name, _id: { $ne: id } });
    if (existing) {
      return { status: "conflict", reason: "A platform with this name already exists" };
    }
  }

  const update = {};
  if (name) update.name = name;
  if (status) update.status = status;

  const updated = await Platform.findByIdAndUpdate(id, update, { new: true }).lean();

  return { status: "updated", data: updated };
}

export async function deletePlatform(id) {
  const platform = await Platform.findByIdAndDelete(id);
  return platform;
}

export async function getAllPlatforms() {
  return Platform.find({ status: "active" }).sort({ name: 1 }).lean();
}
