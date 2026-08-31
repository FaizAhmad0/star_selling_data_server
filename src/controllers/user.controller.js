import * as userService from "../services/user.service.js";
import { sendSuccess, sendError } from "../utils/response.js";
import asyncHandler from "../utils/async-handler.js";

export const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, manager, batch, status, joiningDate } = req.query;
  const result = await userService.getUsers({
    page: Number(page),
    limit: Number(limit),
    search,
    manager,
    batch,
    status,
    joiningDate,
  });
  return sendSuccess(res, { message: "Users retrieved successfully", data: result });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await import("mongoose").then((m) =>
    m.default.findOne({ _id: req.params.id, role: "user" }).select("-password -tokenVersion").lean()
  );
  if (!user) return sendError(res, { message: "User not found", statusCode: 404 });
  return sendSuccess(res, { message: "User retrieved successfully", data: user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const result = await userService.updateUser(req.params.id, req.body);
  if (!result) return sendError(res, { message: "User not found", statusCode: 404 });
  if (result.status === "conflict") return sendError(res, { message: result.reason, statusCode: 409 });
  return sendSuccess(res, { message: "User updated successfully", data: result.data });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await userService.deleteUser(req.params.id);
  if (!user) return sendError(res, { message: "User not found", statusCode: 404 });
  return sendSuccess(res, { message: "User deleted successfully", data: { id: user._id } });
});

export const createUser = asyncHandler(async (req, res) => {
  const result = await userService.createUser(req.body);

  if (result.status === "created") {
    return sendSuccess(res, {
      message: "User created successfully",
      data: result.user,
      statusCode: 201,
    });
  }

  if (result.status === "updated") {
    return sendSuccess(res, {
      message: "Existing user updated with new enrollment information",
      data: result.user,
    });
  }

  return sendError(res, {
    message: result.reason,
    statusCode: 409,
  });
});

export const bulkCreateUsers = asyncHandler(async (req, res) => {
  const result = await userService.bulkCreateUsers(req.body);

  return sendSuccess(res, {
    message: "Bulk user processing completed",
    data: {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
    },
  });
});
