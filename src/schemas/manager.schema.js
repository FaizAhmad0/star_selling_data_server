import { z } from "zod";

const createManagerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().email("Invalid email address"),
  primaryContact: z.string().min(1, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  platform: z.string().optional(),
});

const updateManagerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
  email: z.string().email("Invalid email address").optional(),
  primaryContact: z.string().min(1, "Phone number is required").optional(),
  platform: z.string().optional(),
});

const changePasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const managerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export { createManagerSchema, updateManagerSchema, changePasswordSchema, managerQuerySchema };
