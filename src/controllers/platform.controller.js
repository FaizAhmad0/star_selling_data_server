import * as platformService from "../services/platform.service.js";
import { sendSuccess, sendError } from "../utils/response.js";
import asyncHandler from "../utils/async-handler.js";

export const getPlatforms = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status } = req.query;

  const result = await platformService.getPlatforms({
    page: Number(page),
    limit: Number(limit),
    search,
    status,
  });

  return sendSuccess(res, {
    message: "Platforms retrieved successfully",
    data: result,
  });
});

export const getPlatformById = asyncHandler(async (req, res) => {
  const platform = await platformService.getPlatformById(req.params.id);

  if (!platform) {
    return sendError(res, { message: "Platform not found", statusCode: 404 });
  }

  return sendSuccess(res, {
    message: "Platform retrieved successfully",
    data: platform,
  });
});

export const createPlatform = asyncHandler(async (req, res) => {
  const result = await platformService.createPlatform(req.body);

  if (result.status === "conflict") {
    return sendError(res, { message: result.reason, statusCode: 409 });
  }

  return sendSuccess(res, {
    message: "Platform created successfully",
    data: result.data,
    statusCode: 201,
  });
});

export const updatePlatform = asyncHandler(async (req, res) => {
  const result = await platformService.updatePlatform(req.params.id, req.body);

  if (!result) {
    return sendError(res, { message: "Platform not found", statusCode: 404 });
  }

  if (result.status === "conflict") {
    return sendError(res, { message: result.reason, statusCode: 409 });
  }

  return sendSuccess(res, {
    message: "Platform updated successfully",
    data: result.data,
  });
});

export const deletePlatform = asyncHandler(async (req, res) => {
  const platform = await platformService.deletePlatform(req.params.id);

  if (!platform) {
    return sendError(res, { message: "Platform not found", statusCode: 404 });
  }

  return sendSuccess(res, {
    message: "Platform deleted successfully",
    data: { id: platform._id },
  });
});
