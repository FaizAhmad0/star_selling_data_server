import * as supervisorService from "../services/supervisor.service.js";
import { sendSuccess, sendError } from "../utils/response.js";
import asyncHandler from "../utils/async-handler.js";

export const getSupervisors = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status } = req.query;
  const result = await supervisorService.getSupervisors({ page: Number(page), limit: Number(limit), search, status });
  return sendSuccess(res, { message: "Supervisors retrieved successfully", data: result });
});

export const getSupervisorById = asyncHandler(async (req, res) => {
  const supervisor = await supervisorService.getSupervisorById(req.params.id);
  if (!supervisor) return sendError(res, { message: "Supervisor not found", statusCode: 404 });
  return sendSuccess(res, { message: "Supervisor retrieved successfully", data: supervisor });
});

export const createSupervisor = asyncHandler(async (req, res) => {
  const result = await supervisorService.createSupervisor(req.body);
  if (result.status === "conflict") return sendError(res, { message: result.reason, statusCode: 409 });
  return sendSuccess(res, { message: "Supervisor created successfully", data: result.data, statusCode: 201 });
});

export const updateSupervisor = asyncHandler(async (req, res) => {
  const result = await supervisorService.updateSupervisor(req.params.id, req.body);
  if (!result) return sendError(res, { message: "Supervisor not found", statusCode: 404 });
  if (result.status === "conflict") return sendError(res, { message: result.reason, statusCode: 409 });
  return sendSuccess(res, { message: "Supervisor updated successfully", data: result.data });
});

export const changeSupervisorPassword = asyncHandler(async (req, res) => {
  const result = await supervisorService.changeSupervisorPassword(req.params.id, req.body.password);
  if (!result) return sendError(res, { message: "Supervisor not found", statusCode: 404 });
  return sendSuccess(res, { message: "Password updated successfully" });
});

export const updateSupervisorStatus = asyncHandler(async (req, res) => {
  const supervisor = await supervisorService.updateSupervisorStatus(req.params.id, req.body.active);
  if (!supervisor) return sendError(res, { message: "Supervisor not found", statusCode: 404 });
  return sendSuccess(res, { message: "Supervisor status updated successfully", data: supervisor });
});

export const deleteSupervisor = asyncHandler(async (req, res) => {
  const supervisor = await supervisorService.deleteSupervisor(req.params.id);
  if (!supervisor) return sendError(res, { message: "Supervisor not found", statusCode: 404 });
  return sendSuccess(res, { message: "Supervisor deleted successfully", data: { id: supervisor._id } });
});
