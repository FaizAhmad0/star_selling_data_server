import { Router } from "express";
import { getAdminStats, getManagerStats, getPlatformStats } from "../controllers/stats.controller.js";
import authenticate from "../middlewares/auth.middleware.js";
import authorize from "../middlewares/authorize.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/admin", authorize("admin", "supervisor"), getAdminStats);
router.get(
  "/admin/platform/:platform",
  authorize("admin", "supervisor"),
  getPlatformStats,
);
router.get("/manager", authorize("manager"), getManagerStats);

export default router;
