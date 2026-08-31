import { Router } from "express";
import {
  getManagers,
  getManagerById,
  createManager,
  updateManagerStatus,
  deleteManager,
} from "../controllers/manager.controller.js";
import validate from "../middlewares/validate.middleware.js";
import { createManagerSchema } from "../schemas/manager.schema.js";
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
router.patch("/:id/status", authorize("admin"), updateManagerStatus);
router.delete("/:id", authorize("admin"), deleteManager);

export default router;
