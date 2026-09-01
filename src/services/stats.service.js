import User from "../models/user.model.js";

const PLATFORM_FIELD_MAP = {
  amazon: {
    enrollmentId: "enrollmentIdAmazon",
    date: "dateAmazon",
    batch: "batchAmazon",
    manager: "amazonManager",
  },
  website: {
    enrollmentId: "enrollmentIdWebsite",
    date: "dateWebsite",
    batch: "batchWebsite",
    manager: "websiteManager",
  },
  etsy: {
    enrollmentId: "enrollmentIdEtsy",
    date: "dateEtsy",
    batch: "batchEtsy",
    manager: "etsyManager",
  },
};

export async function getAdminStats() {
  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    totalManagers,
    totalSupervisors,
    usersByPlatform,
    usersByManager,
    recentUsers,
    monthlyGrowth,
    enrollmentsByMonth,
  ] = await Promise.all([
    User.countDocuments({ role: "user" }),
    User.countDocuments({ role: "user", tokenVersion: { $gte: 0 } }),
    User.countDocuments({ role: "user", tokenVersion: -1 }),
    User.countDocuments({ role: "manager" }),
    User.countDocuments({ role: "supervisor" }),
    User.aggregate([
      { $match: { role: "user" } },
      {
        $facet: {
          amazon: [
            { $match: { enrollmentIdAmazon: { $type: "string" } } },
            { $count: "count" },
          ],
          website: [
            { $match: { enrollmentIdWebsite: { $type: "string" } } },
            { $count: "count" },
          ],
          etsy: [
            { $match: { enrollmentIdEtsy: { $type: "string" } } },
            { $count: "count" },
          ],
        },
      },
    ]),
    User.aggregate([
      { $match: { role: "user" } },
      {
        $lookup: {
          from: "users",
          let: { amz: "$amazonManager", wb: "$websiteManager", etsy: "$etsyManager" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$_id", "$$amz"] },
                    { $eq: ["$_id", "$$wb"] },
                    { $eq: ["$_id", "$$etsy"] },
                  ],
                },
              },
            },
          ],
          as: "managers",
        },
      },
      { $unwind: { path: "$managers", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$managers._id",
          name: { $first: "$managers.name" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    User.find({ role: "user" })
      .select("name email enrollmentIdAmazon enrollmentIdWebsite enrollmentIdEtsy createdAt")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    (async () => {
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: d.toISOString().slice(0, 7),
          label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
        });
      }

      const results = await User.aggregate([
        { $match: { role: "user" } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      const countMap = {};
      results.forEach((r) => { countMap[r._id] = r.count; });

      return months.map((m) => ({
        month: m.month,
        label: m.label,
        count: countMap[m.month] || 0,
      }));
    })(),
    (async () => {
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: d.toISOString().slice(0, 7),
          label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
        });
      }

      const results = await User.aggregate([
        { $match: { role: "user" } },
        {
          $project: {
            monthAmazon: {
              $cond: [{ $type: "$dateAmazon" }, { $substrCP: ["$dateAmazon", 0, 7] }, null],
            },
            monthWebsite: {
              $cond: [{ $type: "$dateWebsite" }, { $substrCP: ["$dateWebsite", 0, 7] }, null],
            },
            monthEtsy: {
              $cond: [{ $type: "$dateEtsy" }, { $substrCP: ["$dateEtsy", 0, 7] }, null],
            },
          },
        },
        {
          $facet: {
            amazon: [
              { $match: { monthAmazon: { $ne: null } } },
              { $group: { _id: "$monthAmazon", count: { $sum: 1 } } },
            ],
            website: [
              { $match: { monthWebsite: { $ne: null } } },
              { $group: { _id: "$monthWebsite", count: { $sum: 1 } } },
            ],
            etsy: [
              { $match: { monthEtsy: { $ne: null } } },
              { $group: { _id: "$monthEtsy", count: { $sum: 1 } } },
            ],
          },
        },
      ]);

      const amzMap = {};
      const wbMap = {};
      const etsyMap = {};
      results[0].amazon.forEach((r) => { amzMap[r._id] = r.count; });
      results[0].website.forEach((r) => { wbMap[r._id] = r.count; });
      results[0].etsy.forEach((r) => { etsyMap[r._id] = r.count; });

      return months.map((m) => ({
        month: m.month,
        label: m.label,
        amazon: amzMap[m.month] || 0,
        website: wbMap[m.month] || 0,
        etsy: etsyMap[m.month] || 0,
      }));
    })(),
  ]);

  const platformData = usersByPlatform[0] || {};
  const totalEnrollments =
    (platformData.amazon?.[0]?.count || 0) +
    (platformData.website?.[0]?.count || 0) +
    (platformData.etsy?.[0]?.count || 0);

  const prevMonth = monthlyGrowth.length >= 2 ? monthlyGrowth[monthlyGrowth.length - 2].count : 0;
  const currMonth = monthlyGrowth.length >= 1 ? monthlyGrowth[monthlyGrowth.length - 1].count : 0;
  const monthlyGrowthPercent = prevMonth > 0 ? Math.round(((currMonth - prevMonth) / prevMonth) * 100) : currMonth > 0 ? 100 : 0;

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    totalManagers,
    totalSupervisors,
    totalEnrollments,
    monthlyGrowthPercent,
    usersByPlatform: {
      amazon: platformData.amazon?.[0]?.count || 0,
      website: platformData.website?.[0]?.count || 0,
      etsy: platformData.etsy?.[0]?.count || 0,
    },
    usersByManager: usersByManager.map((m) => ({ name: m.name, count: m.count })),
    recentUsers,
    monthlyGrowth,
    enrollmentsByMonth,
  };
}

export async function getManagerStats(managerId) {
  const managerFilter = {
    $or: [
      { amazonManager: managerId },
      { websiteManager: managerId },
      { etsyManager: managerId },
    ],
  };

  const baseFilter = { role: "user", ...managerFilter };

  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    usersByPlatform,
    recentUsers,
    monthlyGrowth,
    enrollmentsByMonth,
  ] = await Promise.all([
    User.countDocuments(baseFilter),
    User.countDocuments({ ...baseFilter, tokenVersion: { $gte: 0 } }),
    User.countDocuments({ ...baseFilter, tokenVersion: -1 }),
    User.aggregate([
      { $match: baseFilter },
      {
        $facet: {
          amazon: [
            { $match: { enrollmentIdAmazon: { $type: "string" } } },
            { $count: "count" },
          ],
          website: [
            { $match: { enrollmentIdWebsite: { $type: "string" } } },
            { $count: "count" },
          ],
          etsy: [
            { $match: { enrollmentIdEtsy: { $type: "string" } } },
            { $count: "count" },
          ],
        },
      },
    ]),
    User.find(baseFilter)
      .select("name email enrollmentIdAmazon enrollmentIdWebsite enrollmentIdEtsy createdAt")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    (async () => {
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: d.toISOString().slice(0, 7),
          label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
        });
      }

      const results = await User.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      const countMap = {};
      results.forEach((r) => { countMap[r._id] = r.count; });

      return months.map((m) => ({
        month: m.month,
        label: m.label,
        count: countMap[m.month] || 0,
      }));
    })(),
    (async () => {
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: d.toISOString().slice(0, 7),
          label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
        });
      }

      const results = await User.aggregate([
        { $match: baseFilter },
        {
          $project: {
            monthAmazon: {
              $cond: [{ $type: "$dateAmazon" }, { $substrCP: ["$dateAmazon", 0, 7] }, null],
            },
            monthWebsite: {
              $cond: [{ $type: "$dateWebsite" }, { $substrCP: ["$dateWebsite", 0, 7] }, null],
            },
            monthEtsy: {
              $cond: [{ $type: "$dateEtsy" }, { $substrCP: ["$dateEtsy", 0, 7] }, null],
            },
          },
        },
        {
          $facet: {
            amazon: [
              { $match: { monthAmazon: { $ne: null } } },
              { $group: { _id: "$monthAmazon", count: { $sum: 1 } } },
            ],
            website: [
              { $match: { monthWebsite: { $ne: null } } },
              { $group: { _id: "$monthWebsite", count: { $sum: 1 } } },
            ],
            etsy: [
              { $match: { monthEtsy: { $ne: null } } },
              { $group: { _id: "$monthEtsy", count: { $sum: 1 } } },
            ],
          },
        },
      ]);

      const amzMap = {};
      const wbMap = {};
      const etsyMap = {};
      results[0].amazon.forEach((r) => { amzMap[r._id] = r.count; });
      results[0].website.forEach((r) => { wbMap[r._id] = r.count; });
      results[0].etsy.forEach((r) => { etsyMap[r._id] = r.count; });

      return months.map((m) => ({
        month: m.month,
        label: m.label,
        amazon: amzMap[m.month] || 0,
        website: wbMap[m.month] || 0,
        etsy: etsyMap[m.month] || 0,
      }));
    })(),
  ]);

  const platformData = usersByPlatform[0] || {};
  const totalEnrollments =
    (platformData.amazon?.[0]?.count || 0) +
    (platformData.website?.[0]?.count || 0) +
    (platformData.etsy?.[0]?.count || 0);

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    totalEnrollments,
    usersByPlatform: {
      amazon: platformData.amazon?.[0]?.count || 0,
      website: platformData.website?.[0]?.count || 0,
      etsy: platformData.etsy?.[0]?.count || 0,
    },
    recentUsers,
    monthlyGrowth,
    enrollmentsByMonth,
  };
}

export async function getPlatformStats(platform) {
  const fields = PLATFORM_FIELD_MAP[platform];
  if (!fields) return null;

  const matchStage = { role: "user", [fields.enrollmentId]: { $type: "string" } };

  const [
    totalCount,
    activeCount,
    inactiveCount,
    usersByManager,
    usersByBatch,
    monthlyEnrollments,
    recentUsers,
  ] = await Promise.all([
    User.countDocuments(matchStage),
    User.countDocuments({ ...matchStage, tokenVersion: { $gte: 0 } }),
    User.countDocuments({ ...matchStage, tokenVersion: -1 }),
    User.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: fields.manager,
          foreignField: "_id",
          as: "managerDoc",
        },
      },
      { $unwind: { path: "$managerDoc", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$managerDoc._id",
          name: { $first: "$managerDoc.name" },
          count: { $sum: 1 },
        },
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    User.aggregate([
      { $match: { ...matchStage, [fields.batch]: { $type: "string" } } },
      {
        $group: {
          _id: `$${fields.batch}`,
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    (async () => {
      const now = new Date();
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          month: d.toISOString().slice(0, 7),
          label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
        });
      }

      const results = await User.aggregate([
        { $match: { role: "user", [fields.date]: { $type: "string" } } },
        {
          $project: {
            month: { $substrCP: [`$${fields.date}`, 0, 7] },
          },
        },
        {
          $group: {
            _id: "$month",
            count: { $sum: 1 },
          },
        },
      ]);

      const countMap = {};
      results.forEach((r) => { countMap[r._id] = r.count; });

      return months.map((m) => ({
        month: m.month,
        label: m.label,
        count: countMap[m.month] || 0,
      }));
    })(),
    User.find(matchStage)
      .select(`name email primaryContact ${fields.enrollmentId} ${fields.date} ${fields.batch} createdAt`)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  return {
    platform,
    totalCount,
    activeCount,
    inactiveCount,
    usersByManager: usersByManager.map((m) => ({ name: m.name, count: m.count })),
    usersByBatch: usersByBatch.map((b) => ({ batch: b._id, count: b.count })),
    monthlyEnrollments,
    recentUsers,
  };
}
