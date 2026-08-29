import { Router } from "express";
import { sendSuccess } from "../utils/response.js";

const router = Router();

router.get("/health", (req, res) => {
  sendSuccess(res, { message: "API is healthy" });
});

export default router;
