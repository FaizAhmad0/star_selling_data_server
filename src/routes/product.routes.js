import { Router } from "express";
import { bulkImportProducts, getProducts, updateProductVariantStock } from "../controllers/product.controller.js";
import { bulkProductImportSchema, productQuerySchema, productVariantParamsSchema, updateProductStockSchema } from "../schemas/product.schema.js";
import authenticate from "../middlewares/auth.middleware.js";
import authorize from "../middlewares/authorize.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = Router();
router.use(authenticate, authorize("admin"));
router.get("/", validate(productQuerySchema, "query"), getProducts);
router.post("/bulk-import", validate(bulkProductImportSchema), bulkImportProducts);
router.patch(
  "/:productId/variants/:variantId/stock",
  validate(productVariantParamsSchema, "params"),
  validate(updateProductStockSchema),
  updateProductVariantStock,
);

export default router;
