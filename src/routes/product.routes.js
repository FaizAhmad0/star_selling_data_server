import { Router } from "express";
import { bulkImportProducts } from "../controllers/product.controller.js";
import { bulkProductImportSchema } from "../schemas/product.schema.js";
import authenticate from "../middlewares/auth.middleware.js";
import authorize from "../middlewares/authorize.middleware.js";
import validate from "../middlewares/validate.middleware.js";

const router = Router();
router.use(authenticate, authorize("admin"));
router.post("/bulk-import", validate(bulkProductImportSchema), bulkImportProducts);

export default router;
