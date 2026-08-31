import * as managerService from "../services/manager.service.js";
import { sendSuccess, sendError } from "../utils/response.js";
import asyncHandler from "../utils/async-handler.js";

export const getManagers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status } = req.query;

  const result = await managerService.getManagers({
    page: Number(page),
    limit: Number(limit),
    search,
    status,
  });

  return sendSuccess(res, {
    message: "Managers retrieved successfully",
    data: result,
  });
});

export const getManagerById = asyncHandler(async (req, res) => {
  const manager = await managerService.getManagerById(req.params.id);

  if (!manager) {
    return sendError(res, { message: "Manager not found", statusCode: 404 });
  }

  return sendSuccess(res, {
    message: "Manager retrieved successfully",
    data: manager,
  });
});

export const createManager = asyncHandler(async (req, res) => {
  const result = await managerService.createManager(req.body);

  if (result.status === "conflict") {
    return sendError(res, { message: result.reason, statusCode: 409 });
  }

  return sendSuccess(res, {
    message: "Manager created successfully",
    data: result.data,
    statusCode: 201,
  });
});

export const updateManager = asyncHandler(async (req, res) => {
  const result = await managerService.updateManager(req.params.id, req.body);

  if (!result) {
    return sendError(res, { message: "Manager not found", statusCode: 404 });
  }

  if (result.status === "conflict") {
    return sendError(res, { message: result.reason, statusCode: 409 });
  }

  return sendSuccess(res, {
    message: "Manager updated successfully",
    data: result.data,
  });
});

export const changeManagerPassword = asyncHandler(async (req, res) => {
  const result = await managerService.changeManagerPassword(
    req.params.id,
    req.body.password
  );

  if (!result) {
    return sendError(res, { message: "Manager not found", statusCode: 404 });
  }

  return sendSuccess(res, {
    message: "Password updated successfully",
  });
});

export const updateManagerStatus = asyncHandler(async (req, res) => {
  const manager = await managerService.updateManagerStatus(
    req.params.id,
    req.body.active
  );

  if (!manager) {
    return sendError(res, { message: "Manager not found", statusCode: 404 });
  }

  return sendSuccess(res, {
    message: "Manager status updated successfully",
    data: manager,
  });
});

export const deleteManager = asyncHandler(async (req, res) => {
  const manager = await managerService.deleteManager(req.params.id);

  if (!manager) {
    return sendError(res, { message: "Manager not found", statusCode: 404 });
  }

  return sendSuccess(res, {
    message: "Manager deleted successfully",
    data: { id: manager._id },
  });
});
