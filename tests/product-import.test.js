import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { Category, Product, ProductColor, ProductVariant } from "../src/models/product.model.js";
import { bulkImportProducts } from "../src/services/product.service.js";
import { bulkProductImportSchema, parseProductImportRow, PRODUCT_IMPORT_HEADERS } from "../src/schemas/product.schema.js";

const requireClient = createRequire(new URL("../../client/package.json", import.meta.url));
const XLSX = requireClient("xlsx");
const workbook = XLSX.readFile(fileURLToPath(new URL("../../client/public/sample.xlsx", import.meta.url)));
const templateRow = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])[0];
const source = (overrides = {}, rowNumber = 2) => ({ rowNumber, data: { ...templateRow, ...overrides } });

// Exercise the service against the real Mongoose schemas with an isolated,
// in-memory persistence adapter. These tests never connect to the application DB.
function mockDatabase(t, { failSku } = {}) {
  const collections = new Map([Category, Product, ProductColor, ProductVariant].map((Model) => [Model, []]));
  const matches = (record, filter) => Object.entries(filter).every(([key, value]) => value instanceof RegExp ? value.test(record[key]) : String(record[key]) === String(value));

  function save(Model, values, existing) {
    if (Model === ProductVariant && values.sku === failSku) throw new Error("Simulated database write failure");
    const doc = new Model(values);
    const error = doc.validateSync();
    if (error) throw error;
    const record = doc.toObject();
    const records = collections.get(Model);
    const others = records.filter((item) => item !== existing);
    const uniqueKeys = Model === Category ? [["name"]]
      : Model === ProductColor ? [["productId", "color"]]
      : Model === ProductVariant ? [["sku"], ["colorId", "size"]] : [];
    if (uniqueKeys.some((keys) => others.some((item) => keys.every((key) => String(item[key]) === String(record[key]))))) {
      throw Object.assign(new Error("Duplicate key"), { code: 11000 });
    }
    if (existing) records.splice(records.indexOf(existing), 1, record);
    else records.push(record);
    return record;
  }

  for (const [Model, records] of collections) {
    t.mock.method(Model, "init", async () => Model);
    t.mock.method(Model, "find", (filter) => ({ limit: async (limit) => records.filter((record) => matches(record, filter)).slice(0, limit) }));
    t.mock.method(Model, "findOne", async (filter) => records.find((record) => matches(record, filter)) || null);
    t.mock.method(Model, "findById", async (id) => records.find((record) => String(record._id) === String(id)) || null);
    t.mock.method(Model, "create", async (data) => save(Model, data));
    t.mock.method(Model, "findOneAndUpdate", async (filter, update, options) => {
      assert.equal(options.runValidators, true);
      const existing = records.find((record) => matches(record, filter));
      const record = save(Model, { ...(existing || update.$setOnInsert), ...update.$set }, existing);
      return options.includeResultMetadata ? { value: record, lastErrorObject: { updatedExisting: Boolean(existing) } } : record;
    });
  }
  return { categories: collections.get(Category), products: collections.get(Product), colors: collections.get(ProductColor), variants: collections.get(ProductVariant) };
}

test("the actual sample maps all 26 columns, including padded headers and dimensions", () => {
  assert.deepEqual(Object.keys(templateRow).map((key) => key.trim()).filter((key) => !["IMAGE 4", "IMAGE 5"].includes(key)), PRODUCT_IMPORT_HEADERS.filter((key) => !["IMAGE 4", "IMAGE 5"].includes(key)));
  const row = parseProductImportRow(templateRow);
  assert.equal(row.bulletPoints.length, 4);
  assert.equal(row.materials.length, 3);
  assert.equal(row.images.length, 3);
  assert.deepEqual(row.dimensions, { length: 29, width: 23, height: 3 });
  assert.equal(row.estimatedCostPrice, 750);
  assert.equal(row.estimatedSellingPrice, 1499);
  assert.equal(row.estimatedCostPriceOOI, 100);
  assert.equal(row.estimatedSalePriceOOI, 300);
  assert.equal(row.shortDescription, templateRow["SHORT DESCRIPTION"]);
  assert.equal(row.longDescription, templateRow["LONG DESCRIPTION"]);
  assert.equal(row.packageContents, templateRow["PACKAGE CONTENTS"]);
  assert.equal(row.stock, 150);
});

test("imports every field using the unchanged product models", async (t) => {
  const db = mockDatabase(t);
  const result = await bulkImportProducts([source()]);
  assert.equal(result.created, 1);
  assert.deepEqual(result.failed, []);
  assert.equal(db.categories.length, 1);
  assert.equal(db.products.length, 1);
  assert.equal(db.colors.length, 1);
  assert.equal(db.variants.length, 1);
  const parsed = parseProductImportRow(templateRow);
  for (const key of ["title", "bulletPoints", "shortDescription", "longDescription", "materials", "packageContents"]) assert.deepEqual(db.products[0][key], parsed[key]);
  assert.deepEqual(db.colors[0].images, parsed.images);
  assert.equal(db.colors[0].color, parsed.color);
  assert.equal(db.categories[0].name, parsed.category);
  for (const key of ["sku", "size", "stock", "dimensions", "estimatedCostPrice", "estimatedSellingPrice", "estimatedCostPriceOOI", "estimatedSalePriceOOI"]) assert.deepEqual(db.variants[0][key], parsed[key]);
  assert.equal(String(db.products[0].categoryId), String(db.categories[0]._id));
  assert.equal(String(db.colors[0].productId), String(db.products[0]._id));
  assert.equal(String(db.variants[0].colorId), String(db.colors[0]._id));
});

test("re-importing a SKU replaces stock and prices without duplicates or stock increments", async (t) => {
  const db = mockDatabase(t);
  await bulkImportProducts([source()]);
  const result = await bulkImportProducts([source({ STOCK: 0, "ESTD COST PRICE": 0, "ESTD SELLING PRICE": 1250 })]);
  assert.equal(result.created, 0);
  assert.equal(result.updated, 1);
  assert.equal(result.failed.length, 0);
  assert.deepEqual([db.categories.length, db.products.length, db.colors.length, db.variants.length], [1, 1, 1, 1]);
  assert.equal(db.variants[0].stock, 0);
  assert.equal(db.variants[0].estimatedCostPrice, 0);
  assert.equal(db.variants[0].estimatedSellingPrice, 1250);
});

test("reuses category/title/color and keeps colors scoped to their product", async (t) => {
  const db = mockDatabase(t);
  const result = await bulkImportProducts([
    source(),
    source({ SKU: "SECOND-SIZE", SIZE: "L", TITLE: `  ${templateRow.TITLE.toLowerCase()}  ` }, 3),
    source({ SKU: "SECOND-COLOR", COLOR: "BLUE" }, 4),
    source({ SKU: "SECOND-PRODUCT", TITLE: "Another Product" }, 5),
  ]);
  assert.equal(result.created, 4);
  assert.deepEqual(result.failed, []);
  assert.deepEqual([db.categories.length, db.products.length, db.colors.length, db.variants.length], [1, 2, 3, 4]);
});

test("SKU identity and color/size collisions fail without modifying existing inventory", async (t) => {
  const db = mockDatabase(t);
  await bulkImportProducts([source()]);
  const result = await bulkImportProducts([
    source({ TITLE: "Different title", STOCK: 999 }, 2),
    source({ CATEGORY: "Different category", STOCK: 999 }, 3),
    source({ COLOR: "green", STOCK: 999 }, 4),
    source({ SIZE: "XXL", STOCK: 999 }, 5),
    source({ SKU: "CONFLICTING-SKU", STOCK: 999 }, 6),
    source({ SKU: "VALID-NEW-SIZE", SIZE: "XL", STOCK: 3 }, 7),
  ]);
  assert.equal(result.failed.length, 5);
  assert.equal(result.created, 1);
  assert.equal(db.variants[0].stock, 150);
  assert.equal(db.products.length, 1);
  assert.deepEqual(result.failed.map((row) => row.rowNumber), [2, 3, 4, 5, 6]);
  assert.deepEqual(result.failed[0].data, source({ TITLE: "Different title", STOCK: 999 }).data);
});

test("invalid rows are reported before writes and valid later rows still import", async (t) => {
  const db = mockDatabase(t);
  const invalid = [
    { STOCK: -1 }, { STOCK: 1.5 }, { STOCK: "" }, { STOCK: true },
    { DIMENSION: "29XbadX3" }, { "ESTD COST PRICE": -1 },
    { "IMAGE 1": "javascript:alert(1)" }, { TITLE: " " },
  ].map((values, index) => source(values, index + 2));
  const result = await bulkImportProducts([...invalid, source({}, 15)]);
  assert.equal(result.failed.length, invalid.length);
  assert.equal(result.created, 1);
  assert.equal(db.products.length, 1);
  assert.equal(db.variants.length, 1);
  assert.match(result.failed[0].reason, /STOCK/);
  assert.match(result.failed[4].reason, /DIMENSION/);
});

test("a persistence failure is attached to its original row and does not stop the batch", async (t) => {
  const db = mockDatabase(t, { failSku: "FAIL-WRITE" });
  const failedRow = source({ SKU: "FAIL-WRITE" }, 4);
  const result = await bulkImportProducts([failedRow, source({ SKU: "GOOD-WRITE" }, 8)]);
  assert.equal(result.created, 1);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0].rowNumber, 4);
  assert.deepEqual(result.failed[0].data, failedRow.data);
  assert.match(result.failed[0].reason, /Could not save/);
  assert.equal(db.variants.length, 1);
});

test("simultaneous imports of the same title reuse one product without changing the model", async (t) => {
  const db = mockDatabase(t);
  const results = await Promise.all([
    bulkImportProducts([source({ SKU: "CONCURRENT-M" })]),
    bulkImportProducts([source({ SKU: "CONCURRENT-L", SIZE: "L" })]),
  ]);
  assert.equal(results.flatMap((result) => result.failed).length, 0);
  assert.equal(db.products.length, 1);
  assert.equal(db.colors.length, 1);
  assert.equal(db.variants.length, 2);
});

test("request validation bounds batches while leaving row errors for the service", () => {
  assert.equal(bulkProductImportSchema.safeParse({ rows: [] }).success, false);
  assert.equal(bulkProductImportSchema.safeParse({ rows: Array(501).fill(source()) }).success, false);
  assert.equal(bulkProductImportSchema.safeParse({ rows: [source({ STOCK: -1 })] }).success, true);
});

test("HTTP endpoint enforces CSRF/admin authentication and returns per-row import results", async (t) => {
  const db = mockDatabase(t);
  const previousSecret = process.env.JWT_SECRET;
  const previousEnvironment = process.env.NODE_ENV;
  process.env.JWT_SECRET = "isolated-product-import-test-secret";
  process.env.NODE_ENV = "test";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  });
  const { default: User } = await import("../src/models/user.model.js");
  const { default: app } = await import("../src/app.js");
  const { signToken } = await import("../src/utils/jwt.js");
  let role = "admin";
  t.mock.method(User, "findById", async () => ({ role, tokenVersion: 0 }));
  t.mock.method(console, "log", () => {});
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/v1/products/bulk-import`;
  const token = signToken({ id: "507f1f77bcf86cd799439011", role: "admin", tokenVersion: 0 });
  const csrfHeaders = { cookie: "csrf_token=import-test", "x-csrf-token": "import-test" };
  const headers = { ...csrfHeaders, cookie: `csrf_token=import-test; token=${token}` };
  const post = async (body, requestHeaders = headers) => {
    const response = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json", ...requestHeaders },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5_000),
    });
    return { status: response.status, body: await response.json() };
  };

  assert.equal((await post({ rows: [source()] }, {})).status, 403);
  assert.equal((await post({ rows: [source()] }, csrfHeaders)).status, 401);
  role = "manager";
  assert.equal((await post({ rows: [source()] })).status, 403);
  role = "admin";
  assert.equal((await post({ rows: [] })).status, 400);
  const response = await post({ rows: [source(), source({ STOCK: -1 }, 7)] });
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.created, 1);
  assert.equal(response.body.data.failed[0].rowNumber, 7);
  assert.equal(response.body.data.failed[0].data.STOCK, -1);
  assert.equal(db.variants.length, 1);
  const repeat = await post({ rows: [source({ STOCK: 42 })] });
  assert.equal(repeat.body.data.updated, 1);
  assert.equal(db.variants[0].stock, 42);
});
