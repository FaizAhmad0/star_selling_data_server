import * as statsService from "../services/stats.service.js";
import { sendSuccess, sendError } from "../utils/response.js";
import asyncHandler from "../utils/async-handler.js";

export const getAdminStats = asyncHandler(async (req, res) => {
  const result = await statsService.getAdminStats();
  return sendSuccess(res, { message: "Admin stats retrieved successfully", data: result });
});

export const getPlatformStats = asyncHandler(async (req, res) => {
  const { platform } = req.params;
  if (!["amazon", "website", "etsy"].includes(platform)) {
    return sendError(res, { message: "Invalid platform", statusCode: 400 });
  }
  const result = await statsService.getPlatformStats(platform);
  if (!result) {
    return sendError(res, { message: "Platform not found", statusCode: 404 });
  }
  return sendSuccess(res, { message: `${platform} stats retrieved successfully`, data: result });
});
