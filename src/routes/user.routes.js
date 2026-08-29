import { Router } from "express";
import { createUser, bulkCreateUsers } from "../controllers/user.controller.js";
import validate from "../middlewares/validate.middleware.js";
import { createUserSchema, bulkUserSchema } from "../schemas/user.schema.js";
import authenticate from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/create", validate(createUserSchema), createUser);
router.post("/bulk-create", validate(bulkUserSchema, "body"), bulkCreateUsers);

export default router;
