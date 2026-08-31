import { Router } from "express";
import { getSupervisors, getSupervisorById, createSupervisor, updateSupervisor, changeSupervisorPassword, updateSupervisorStatus, deleteSupervisor } from "../controllers/supervisor.controller.js";
import validate from "../middlewares/validate.middleware.js";
import { createSupervisorSchema, updateSupervisorSchema, changePasswordSchema } from "../schemas/supervisor.schema.js";
import authenticate from "../middlewares/auth.middleware.js";
import authorize from "../middlewares/authorize.middleware.js";

const router = Router();
router.use(authenticate);
router.get("/", getSupervisors);
router.get("/:id", getSupervisorById);
router.post("/", validate(createSupervisorSchema), authorize("admin"), createSupervisor);
router.put("/:id", validate(updateSupervisorSchema), authorize("admin"), updateSupervisor);
router.patch("/:id/password", validate(changePasswordSchema), authorize("admin"), changeSupervisorPassword);
router.patch("/:id/status", authorize("admin"), updateSupervisorStatus);
router.delete("/:id", authorize("admin"), deleteSupervisor);
export default router;
