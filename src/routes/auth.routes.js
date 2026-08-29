import { Router } from "express";
import { login, verifyOtp, logout, me } from "../controllers/auth.controller.js";
import validate from "../middlewares/validate.middleware.js";
import { loginSchema, verifyOtpSchema } from "../schemas/auth.schema.js";
import authenticate from "../middlewares/auth.middleware.js";
import { loginLimiter, otpLimiter } from "../middlewares/rate-limit.middleware.js";

const router = Router();

router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/verify-otp", otpLimiter, validate(verifyOtpSchema), verifyOtp);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
