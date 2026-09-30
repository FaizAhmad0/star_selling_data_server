import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { Category, Product, ProductColor, ProductVariant } from "../src/models/product.model.js";
import { bulkImportProducts, getProducts } from "../src/services/product.service.js";
import { bulkProductImportSchema, parseProductImportRow, PRODUCT_IMPORT_HEADERS, productQuerySchema } from "../src/schemas/product.schema.js";

const requireClient = createRequire(new URL("../../client/package.json", import.meta.url));
const XLSX = requireClient("xlsx");
const workbook = XLSX.readFile(fileURLToPath(new URL("../../client/public/sample.xlsx", import.meta.url)));
const templateRow = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])[0];
const source = (overrides = {}, rowNumber = 2) => ({ rowNumber, data: { ...templateRow, ...overrides } });

// Exercise the service against the real Mongoose schemas with an isolated,
// in-memory persistence adapter. These tests never connect to the application DB.
function mockDatabase(t, { failSku } = {}) {
  const collections = new Map([Category, Product, ProductColor, ProductVariant].map((Model) => [Model, []]));
  const matchesValue = (actual, expected) => {
    if (expected instanceof RegExp) return Array.isArray(actual) ? actual.some((value) => expected.test(value)) : expected.test(actual || "");
    if (expected && typeof expected === "object" && "$in" in expected) return expected.$in.some((value) => String(actual) === String(value));
    if (expected && typeof expected === "object" && ("$gte" in expected || "$lt" in expected)) {
      return (!expected.$gte || actual >= expected.$gte) && (!expected.$lt || actual < expected.$lt);
    }
    return String(actual) === String(expected);
  };
  const matches = (record, filter) => Object.entries(filter).every(([key, value]) => key === "$or" ? value.some((part) => matches(record, part)) : matchesValue(record[key], value));

  function query(Model, filter) {
    let sorting = {};
    let offset = 0;
    let count = Infinity;
    let selection;
    let populateCategory = false;
    const execute = () => {
      let records = collections.get(Model).filter((record) => matches(record, filter)).sort((left, right) => {
        for (const [key, order] of Object.entries(sorting)) {
          const a = left[key] instanceof Date ? left[key].getTime() : String(left[key]);
          const b = right[key] instanceof Date ? right[key].getTime() : String(right[key]);
          if (a !== b) return a < b ? -order : order;
        }
        return 0;
      }).slice(offset, offset + count);
      if (populateCategory) records = records.map((record) => ({ ...record, categoryId: collections.get(Category).find((category) => String(category._id) === String(record.categoryId)) || null }));
      if (selection) records = records.map((record) => Object.fromEntries(["_id", ...selection.split(" ")].map((key) => [key, record[key]])));
      return records;
    };
    const chain = {
      sort(value) { sorting = value; return chain; },
      skip(value) { offset = value; return chain; },
      limit(value) { count = value; return chain; },
      select(value) { selection = value; return chain; },
      populate(path) { assert.equal(path, "categoryId"); populateCategory = true; return chain; },
      lean() { return Promise.resolve(execute()); },
      then(resolve, reject) { return Promise.resolve().then(execute).then(resolve, reject); },
    };
    return chain;
  }

  function save(Model, values, existing) {
    if (Model === ProductVariant && values.sku === failSku) throw new Error("Simulated database write failure");
    const doc = new Model({ createdAt: new Date(), ...values });
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
    t.mock.method(Model, "find", (filter) => query(Model, filter));
    t.mock.method(Model, "countDocuments", async (filter) => records.filter((record) => matches(record, filter)).length);
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

test("lists every product across pages with category, colors, variants, and total stock", async (t) => {
  const db = mockDatabase(t);
  await bulkImportProducts([
    source({ SKU: "ALPHA-M", TITLE: "Alpha", STOCK: 2 }),
    source({ SKU: "ALPHA-L", TITLE: "Alpha", SIZE: "L", STOCK: 3 }),
    source({ SKU: "BETA-M", TITLE: "Beta", STOCK: 0 }),
    source({ SKU: "GAMMA-M", TITLE: "Gamma", STOCK: 8 }),
  ]);
  const first = await getProducts({ page: 1, limit: 2 });
  const second = await getProducts({ page: 2, limit: 2 });
  assert.deepEqual(first.meta, { page: 1, limit: 2, total: 3, totalPages: 2 });
  assert.deepEqual(first.data.map((product) => product.title), ["Gamma", "Beta"]);
  assert.equal(second.data[0].title, "Alpha");
  assert.equal(second.data[0].variantCount, 2);
  assert.equal(second.data[0].totalStock, 5);
  assert.equal(second.data[0].colors.length, 1);
  assert.equal(second.data[0].colors[0].variants.length, 2);
  assert.equal(second.data[0].category, db.categories[0].name);
  assert.deepEqual(second.data[0].colors[0].images, parseProductImportRow(templateRow).images);
  assert.equal(first.data[1].totalStock, 0);
  assert.deepEqual((await getProducts({ page: 5, limit: 2 })).data, []);
});

test("searches title, SKU, category, and materials literally, combining filters", async (t) => {
  mockDatabase(t);
  await bulkImportProducts([
    source({ SKU: "ALPHA-M", TITLE: "Alpha [Set]", CATEGORY: "Clothing", "MATERIAL 1": "Cotton" }),
    source({ SKU: "ALPHA-L", TITLE: "Alpha [Set]", CATEGORY: "Clothing", SIZE: "L" }),
    source({ SKU: "BETA-M", TITLE: "Beta", CATEGORY: "Accessories", "MATERIAL 1": "Silk" }),
  ]);
  for (const search of ["alpha-l", "[", "Clothing", "cotton"]) {
    const response = await getProducts({ search });
    assert.equal(response.meta.total, 1);
    assert.equal(response.data[0].title, "Alpha [Set]");
    assert.equal(response.data[0].variantCount, 2);
  }
  assert.equal((await getProducts({ search: ".*" })).meta.total, 0);
  assert.equal((await getProducts({ category: "Accessories", material: "silk" })).data[0].title, "Beta");
  assert.equal((await getProducts({ category: "Clothing", material: "silk" })).meta.total, 0);
  assert.equal((await getProducts({ category: "Unknown" })).meta.total, 0);
});

test("created-date filters include the full end date and exclude the following day", async (t) => {
  const db = mockDatabase(t);
  await bulkImportProducts([
    source({ SKU: "EARLY", TITLE: "Early" }),
    source({ SKU: "END-DAY", TITLE: "End day" }),
    source({ SKU: "NEXT-DAY", TITLE: "Next day" }),
  ]);
  db.products[0].createdAt = new Date("2026-09-01T00:00:00.000Z");
  db.products[1].createdAt = new Date("2026-09-30T23:59:59.999Z");
  db.products[2].createdAt = new Date("2026-10-01T00:00:00.000Z");
  const result = await getProducts({ createdAtFrom: "2026-09-30", createdAtTo: "2026-09-30" });
  assert.deepEqual(result.data.map((product) => product.title), ["End day"]);
});

test("empty inventory and products without variants or a category remain readable", async (t) => {
  const db = mockDatabase(t);
  assert.deepEqual(await getProducts(), { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } });
  const category = await Category.create({ name: "Empty" });
  await Product.create({ title: "No variants", categoryId: category._id });
  db.categories.length = 0;
  const result = await getProducts();
  assert.equal(result.data[0].category, "");
  assert.equal(result.data[0].categoryId, null);
  assert.deepEqual(result.data[0].colors, []);
  assert.equal(result.data[0].totalStock, 0);
  assert.equal(result.data[0].variantCount, 0);
});

test("validates pagination, search types, actual dates, and date range order", () => {
  assert.deepEqual(productQuerySchema.parse({}), { page: 1, limit: 10 });
  for (const query of [
    { page: 0 }, { page: "bad" }, { limit: 101 }, { search: { $ne: "" } },
    { createdAtFrom: "2026-02-30" }, { createdAtTo: "invalid" },
    { createdAtFrom: "2026-10-01", createdAtTo: "2026-09-01" },
  ]) assert.equal(productQuerySchema.safeParse(query).success, false);
});

test("HTTP product endpoints enforce admin authentication and return import/list results", async (t) => {
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

  assert.equal((await post({ rows: [source()] }, {})).status, 401);
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

  const get = async (query = "", requestHeaders = { cookie: `token=${token}` }) => {
    const response = await fetch(`${url.replace("/bulk-import", "")}${query}`, { headers: requestHeaders, signal: AbortSignal.timeout(5_000) });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await get("", {})).status, 401);
  role = "manager";
  assert.equal((await get()).status, 403);
  role = "admin";
  assert.equal((await get("?limit=0")).status, 400);
  const list = await get("?page=1&limit=10");
  assert.equal(list.status, 200);
  assert.equal(list.body.data.meta.total, 1);
  assert.equal(list.body.data.data[0].totalStock, 42);
  assert.equal(list.body.data.data[0].colors[0].variants[0].sku, templateRow.SKU);
});
