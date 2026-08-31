import { Router } from "express";
import { getUsers, getUserById, createUser, updateUser, deleteUser, bulkCreateUsers } from "../controllers/user.controller.js";
import validate from "../middlewares/validate.middleware.js";
import { createUserSchema, bulkUserSchema } from "../schemas/user.schema.js";
import authenticate from "../middlewares/auth.middleware.js";
import authorize from "../middlewares/authorize.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/", getUsers);
router.get("/:id", getUserById);
router.post("/create", authorize("admin"), validate(createUserSchema), createUser);
router.put("/:id", authorize("admin"), updateUser);
router.delete("/:id", authorize("admin"), deleteUser);
router.post("/bulk-create", authorize("admin"), validate(bulkUserSchema, "body"), bulkCreateUsers);

export default router;
