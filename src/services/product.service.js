import { Category, Product, ProductColor, ProductVariant } from "../models/product.model.js";
import { normalizeProductTitle, parseProductImportRow } from "../schemas/product.schema.js";
import AppError from "../utils/app-error.js";

const conflict = (message) => new AppError(message, 409);
const canonical = (value) => String(value).trim().replace(/\s+/g, " ").toLowerCase();
const titleLocks = new Map();

const literalSearch = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

export async function getProducts({ page = 1, limit = 10, search, category, material, createdAtFrom, createdAtTo } = {}) {
  const filter = {};
  if (category) {
    const categories = await Category.find({ name: literalSearch(category) }).select("_id").lean();
    filter.categoryId = { $in: categories.map((item) => item._id) };
  }
  if (material) filter.materials = literalSearch(material);
  if (createdAtFrom || createdAtTo) {
    filter.createdAt = {};
    if (createdAtFrom) filter.createdAt.$gte = new Date(`${createdAtFrom}T00:00:00.000Z`);
    if (createdAtTo) {
      const exclusiveEnd = new Date(`${createdAtTo}T00:00:00.000Z`);
      exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
      filter.createdAt.$lt = exclusiveEnd;
    }
  }
  if (search) {
    const regex = literalSearch(search);
    const [categories, variants] = await Promise.all([
      Category.find({ name: regex }).select("_id").lean(),
      ProductVariant.find({ sku: regex }).select("colorId").lean(),
    ]);
    const matchingColors = variants.length
      ? await ProductColor.find({ _id: { $in: variants.map((variant) => variant.colorId) } }).select("productId").lean()
      : [];
    filter.$or = [
      { title: regex }, { shortDescription: regex }, { materials: regex },
      { categoryId: { $in: categories.map((item) => item._id) } },
      { _id: { $in: matchingColors.map((color) => color.productId) } },
    ];
  }

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate("categoryId", "name").lean(),
    Product.countDocuments(filter),
  ]);
  const meta = { page, limit, total, totalPages: Math.ceil(total / limit) };
  if (!products.length) return { data: [], meta };

  // Fetch the current page's relationships in batches, rather than querying each row.
  const colors = await ProductColor.find({ productId: { $in: products.map((product) => product._id) } }).sort({ color: 1, _id: 1 }).lean();
  const variants = colors.length
    ? await ProductVariant.find({ colorId: { $in: colors.map((color) => color._id) } }).sort({ sku: 1, _id: 1 }).lean()
    : [];
  const variantsByColor = new Map();
  for (const variant of variants) {
    const key = String(variant.colorId);
    if (!variantsByColor.has(key)) variantsByColor.set(key, []);
    variantsByColor.get(key).push(variant);
  }
  const colorsByProduct = new Map();
  for (const color of colors) {
    const key = String(color.productId);
    if (!colorsByProduct.has(key)) colorsByProduct.set(key, []);
    colorsByProduct.get(key).push({ ...color, variants: variantsByColor.get(String(color._id)) || [] });
  }
  const data = products.map((product) => {
    const productColors = colorsByProduct.get(String(product._id)) || [];
    const productVariants = productColors.flatMap((color) => color.variants);
    return {
      ...product,
      categoryId: product.categoryId?._id || null,
      category: product.categoryId?.name || "",
      colors: productColors,
      variantCount: productVariants.length,
      totalStock: productVariants.reduce((sum, variant) => sum + (variant.stock || 0), 0),
    };
  });
  return { data, meta };
}

async function withTitleLock(title, operation) {
  // The existing model has no unique title index. Serialize matching titles
  // within this server process without changing the user's product model.
  const key = normalizeProductTitle(title);
  const previous = titleLocks.get(key) || Promise.resolve();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  titleLocks.set(key, pending);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (titleLocks.get(key) === pending) titleLocks.delete(key);
  }
}

async function findOrCreate(Model, filter, data) {
  try {
    return await Model.findOneAndUpdate(filter, { $setOnInsert: data }, {
      upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true,
    });
  } catch (error) {
    // Another import may have inserted the same category or color.
    if (error.code === 11000) {
      const existing = await Model.findOne(filter);
      if (existing) return existing;
    }
    throw error;
  }
}

async function checkCategory(product, categoryName) {
  const category = await Category.findById(product.categoryId);
  if (!category || canonical(category.name) !== categoryName) {
    throw conflict("The existing product belongs to a different or missing category. Use its existing category or a different title.");
  }
}

async function resolveProduct(row) {
  const escapedTitle = row.title.split(/\s+/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  const matches = await Product.find({
    title: new RegExp(`^\\s*${escapedTitle}\\s*$`, "i"),
  }).limit(2);
  if (matches.length > 1) throw conflict("Multiple products have this title. Resolve the duplicate titles before importing a new SKU.");
  if (matches.length === 1) {
    await checkCategory(matches[0], row.category);
    return matches[0];
  }

  const category = await findOrCreate(Category, { name: row.category }, { name: row.category });
  const product = await Product.create({
    title: row.title, categoryId: category._id,
    bulletPoints: row.bulletPoints, shortDescription: row.shortDescription,
    longDescription: row.longDescription, materials: row.materials, packageContents: row.packageContents,
  });
  await checkCategory(product, row.category);
  return product;
}

async function importRow(row) {
  const existingVariant = await ProductVariant.findOne({ sku: row.sku });
  let product;
  let color;
  if (existingVariant) {
    color = await ProductColor.findById(existingVariant.colorId);
    product = color && await Product.findById(color.productId);
    if (!product || !color) throw conflict("This SKU has a missing product or color. Repair the existing variant before importing it.");
    if (normalizeProductTitle(product.title) !== normalizeProductTitle(row.title)) {
      throw conflict("This SKU already belongs to a different product title.");
    }
    await checkCategory(product, row.category);
    if (canonical(color.color) !== row.color || canonical(existingVariant.size) !== canonical(row.size)) {
      throw conflict("This SKU already belongs to a different color or size.");
    }
  } else {
    product = await resolveProduct(row);
    color = await findOrCreate(ProductColor, { productId: product._id, color: row.color }, {
      productId: product._id, color: row.color, images: row.images,
    });
    const sizeVariant = await ProductVariant.findOne({ colorId: color._id, size: row.size });
    if (sizeVariant && sizeVariant.sku !== row.sku) {
      throw conflict(`This product, color, and size already use SKU ${sizeVariant.sku}. Use that SKU to update stock.`);
    }
  }

  // $set makes stock replacement idempotent. Identity fields in the filter prevent
  // a concurrent import from moving an existing SKU to a different product/color.
  const result = await ProductVariant.findOneAndUpdate(
    { sku: row.sku, colorId: color._id, size: row.size },
    {
      $set: {
        stock: row.stock, dimensions: row.dimensions,
        estimatedCostPrice: row.estimatedCostPrice, estimatedSellingPrice: row.estimatedSellingPrice,
        estimatedCostPriceOOI: row.estimatedCostPriceOOI, estimatedSalePriceOOI: row.estimatedSalePriceOOI,
      },
      $setOnInsert: { sku: row.sku, colorId: color._id, size: row.size },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, includeResultMetadata: true },
  );
  return {
    sku: row.sku, productId: product._id, colorId: color._id, variantId: result.value._id,
    status: result.lastErrorObject?.updatedExisting ? "updated" : "created",
  };
}

function rowErrorMessage(error) {
  if (error.name === "ZodError") return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  if (error.isOperational) return error.message;
  if (error.code === 11000) return "SKU or product/color/size already exists with conflicting values. Check the row and retry.";
  if (error.name === "ValidationError") return Object.values(error.errors).map((item) => item.message).join("; ");
  return "Could not save this row. Please retry the import.";
}

export async function bulkImportProducts(rows) {
  const result = { total: rows.length, created: 0, updated: 0, successful: [], failed: [] };
  // Wait for the uniqueness constraints before allowing any concurrent upserts.
  try {
    await Promise.all([Category.init(), Product.init(), ProductColor.init(), ProductVariant.init()]);
  } catch (_error) {
    result.failed = rows.map((row) => ({ ...row, reason: "Product storage could not be initialized. Please retry or contact an administrator." }));
    return result;
  }

  for (const source of rows) {
    try {
      // Validate every column before this row can write anything to the database.
      const row = parseProductImportRow(source.data);
      const saved = await withTitleLock(row.title, () => importRow(row));
      result[saved.status] += 1;
      result.successful.push({ rowNumber: source.rowNumber, ...saved });
    } catch (error) {
      result.failed.push({ rowNumber: source.rowNumber, data: source.data, reason: rowErrorMessage(error) });
    }
  }
  return result;
}
