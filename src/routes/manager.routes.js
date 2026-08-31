import { Router } from "express";
import {
  getManagers,
  getManagerById,
  createManager,
  updateManager,
  changeManagerPassword,
  updateManagerStatus,
  deleteManager,
} from "../controllers/manager.controller.js";
import validate from "../middlewares/validate.middleware.js";
import { createManagerSchema, updateManagerSchema, changePasswordSchema } from "../schemas/manager.schema.js";
import authenticate from "../middlewares/auth.middleware.js";
import authorize from "../middlewares/authorize.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getManagers);
router.get("/:id", getManagerById);
router.post(
  "/",
  validate(createManagerSchema),
  authorize("admin"),
  createManager,
);
router.put("/:id", validate(updateManagerSchema), authorize("admin"), updateManager);
router.patch("/:id/password", validate(changePasswordSchema), authorize("admin"), changeManagerPassword);
router.patch("/:id/status", authorize("admin"), updateManagerStatus);
router.delete("/:id", authorize("admin"), deleteManager);

export default router;
