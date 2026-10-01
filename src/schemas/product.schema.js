import { z } from "zod";

export const productVariantParamsSchema = z.object({
  productId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid product ID"),
  variantId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid variant ID"),
});

export const updateProductStockSchema = z.object({
  stock: z.number().finite().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict();

const filterDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Invalid date");

export const productQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  category: z.string().trim().max(100).optional(),
  material: z.string().trim().max(100).optional(),
  createdAtFrom: filterDate.optional(),
  createdAtTo: filterDate.optional(),
}).refine((query) => !query.createdAtFrom || !query.createdAtTo || query.createdAtFrom <= query.createdAtTo, {
  message: "The start date must be on or before the end date", path: ["createdAtTo"],
});

export const PRODUCT_IMPORT_HEADERS = [
  "SKU", "TITLE", "BULLET POINT 1", "BULLET POINT 2", "BULLET POINT 3", "BULLET POINT 4",
  "SHORT DESCRIPTION", "LONG DESCRIPTION", "DIMENSION", "MATERIAL 1", "MATERIAL 2", "MATERIAL 3",
  "ESTD COST PRICE", "ESTD SELLING PRICE", "ESTD COST PRICE OOI", "ESTD SALE PRICE OOI",
  "PACKAGE CONTENTS", "IMAGE 1", "IMAGE 2", "IMAGE 3", "IMAGE 4", "IMAGE 5",
  "COLOR", "STOCK", "SIZE", "CATEGORY",
];

export const bulkProductImportSchema = z.object({
  rows: z.array(z.object({
    rowNumber: z.number().int().min(2).max(1_048_576),
    // Validate cell values per row in the service, so one bad row does not reject the batch.
    data: z.record(z.unknown()),
  })).min(1, "At least one product row is required").max(500, "Maximum 500 rows per import"),
});

const text = z.preprocess(
  (value) => value == null ? "" : typeof value === "number" ? String(value) : value,
  z.string().trim().max(30_000),
);
const requiredText = text.pipe(z.string().min(1, "Required").max(500));
const numericValue = (value) => {
  if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim())) return Number(value.trim());
  return value;
};
const price = z.preprocess(
  (value) => value == null || value === "" || (typeof value === "string" && !value.trim()) ? null : numericValue(value),
  z.number().finite().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
);
const stock = z.preprocess(numericValue, z.number().finite().int().min(0).max(Number.MAX_SAFE_INTEGER));
const image = text.pipe(z.union([
  z.literal(""),
  z.string().max(2048).url().refine((value) => /^https?:\/\//i.test(value), "Use an http or https image URL"),
]));
const dimension = text.transform((value, context) => {
  if (!value) return { length: null, width: null, height: null };
  const values = value.split(/[x×]/i).map((part) => part.trim());
  if (values.length !== 3 || values.some((part) => !/^\d+(\.\d+)?$/.test(part) || !Number.isFinite(Number(part)) || Number(part) > Number.MAX_SAFE_INTEGER)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Use length x width x height, for example 29X23X3, with non-negative numbers" });
    return z.NEVER;
  }
  return { length: Number(values[0]), width: Number(values[1]), height: Number(values[2]) };
});

const spreadsheetRowSchema = z.object({
  SKU: requiredText,
  TITLE: requiredText,
  CATEGORY: requiredText,
  COLOR: requiredText,
  SIZE: requiredText,
  STOCK: stock,
  DIMENSION: dimension,
  "BULLET POINT 1": text,
  "BULLET POINT 2": text,
  "BULLET POINT 3": text,
  "BULLET POINT 4": text,
  "SHORT DESCRIPTION": text,
  "LONG DESCRIPTION": text,
  "MATERIAL 1": text,
  "MATERIAL 2": text,
  "MATERIAL 3": text,
  "ESTD COST PRICE": price,
  "ESTD SELLING PRICE": price,
  "ESTD COST PRICE OOI": price,
  "ESTD SALE PRICE OOI": price,
  "PACKAGE CONTENTS": text,
  "IMAGE 1": image,
  "IMAGE 2": image,
  "IMAGE 3": image,
  "IMAGE 4": image,
  "IMAGE 5": image,
});

export function normalizeProductTitle(title) {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseProductImportRow(data) {
  const normalized = Object.fromEntries(Object.entries(data).map(([key, value]) => [key.trim().replace(/\s+/g, " ").toUpperCase(), value]));
  const row = spreadsheetRowSchema.parse(normalized);
  return {
    sku: row.SKU.toUpperCase(),
    title: row.TITLE.replace(/\s+/g, " "),
    category: row.CATEGORY.replace(/\s+/g, " ").toLowerCase(),
    color: row.COLOR.replace(/\s+/g, " ").toLowerCase(),
    size: row.SIZE.replace(/\s+/g, " ").toUpperCase(),
    stock: row.STOCK,
    dimensions: row.DIMENSION,
    bulletPoints: [1, 2, 3, 4].map((index) => row[`BULLET POINT ${index}`]).filter(Boolean),
    shortDescription: row["SHORT DESCRIPTION"],
    longDescription: row["LONG DESCRIPTION"],
    materials: [1, 2, 3].map((index) => row[`MATERIAL ${index}`]).filter(Boolean),
    estimatedCostPrice: row["ESTD COST PRICE"],
    estimatedSellingPrice: row["ESTD SELLING PRICE"],
    estimatedCostPriceOOI: row["ESTD COST PRICE OOI"],
    estimatedSalePriceOOI: row["ESTD SALE PRICE OOI"],
    packageContents: row["PACKAGE CONTENTS"],
    images: [1, 2, 3, 4, 5].map((index) => row[`IMAGE ${index}`]).filter(Boolean),
  };
}
