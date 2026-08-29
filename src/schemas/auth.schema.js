import { z } from "zod";

export const loginSchema = z.object({
  uid: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^UID\d+$/, "UID must be in format UID followed by numbers (e.g. UID1)"),
  password: z.string().min(1, "Password is required"),
});

export const verifyOtpSchema = z.object({
  uid: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^UID\d+$/, "UID must be in format UID followed by numbers (e.g. UID1)"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be exactly 6 digits"),
});
