import { z } from "zod";

const createPlatformSchema = z.object({
  name: z.string().min(1, "Platform name is required").max(100, "Name is too long"),
  status: z.enum(["active", "inactive"]).optional(),
});

const updatePlatformSchema = z.object({
  name: z.string().min(1, "Platform name is required").max(100, "Name is too long").optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const platformQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export { createPlatformSchema, updatePlatformSchema, platformQuerySchema };
