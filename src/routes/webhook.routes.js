import { Router } from "express";
import { googleSheetWebhook } from "../controllers/webhook.controller.js";

const router = Router();

router.post("/google-sheet", googleSheetWebhook);

export default router;
