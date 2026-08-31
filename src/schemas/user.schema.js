import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  enrollment: z.string().min(1, "Enrollment is required"),
  primaryContact: z.string().min(1, "Primary contact is required"),
  date: z.string().min(1, "Date is required"),
  batch: z.string().min(1, "Batch is required"),
  manager: z.string().min(1, "Manager is required"),
  enrolledBy: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
  email: z.string().email("Invalid email address").optional(),
  primaryContact: z.string().min(1, "Phone number is required").optional(),
  platforms: z.array(z.string()).optional(),
});

const bulkUserSchema = z.array(createUserSchema).min(1, "At least one user is required").max(500, "Maximum 500 users per batch");

const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  manager: z.string().optional(),
  batch: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  joiningDate: z.string().optional(),
});

export { createUserSchema, updateUserSchema, bulkUserSchema, userQuerySchema };
