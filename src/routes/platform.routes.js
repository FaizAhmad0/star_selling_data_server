import { Router } from "express";
import {
  getPlatforms,
  getPlatformById,
  createPlatform,
  updatePlatform,
  deletePlatform,
} from "../controllers/platform.controller.js";
import validate from "../middlewares/validate.middleware.js";
import { createPlatformSchema, updatePlatformSchema } from "../schemas/platform.schema.js";
import authenticate from "../middlewares/auth.middleware.js";
import authorize from "../middlewares/authorize.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getPlatforms);
router.get("/:id", getPlatformById);
router.post(
  "/",
  validate(createPlatformSchema),
  authorize("admin"),
  createPlatform,
);
router.put("/:id", validate(updatePlatformSchema), authorize("admin"), updatePlatform);
router.delete("/:id", authorize("admin"), deletePlatform);

export default router;
