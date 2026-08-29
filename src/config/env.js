import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().url().default("mongodb://localhost:27017/starselling"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  EMAIL_USER: z.string().default(""),
  EMAIL_PASS: z.string().default(""),
  OTP_EXPIRY_MINUTES: z.coerce.number().default(5),
  MANAGER_OTP_EMAILS: z.string().default("amazontl1@saumiccraft.in,ahmadfaiz8409@gmail.com"),
  DEFAULT_OTP_EMAILS: z.string().default("ahmadfaiz8409@gmail.com,operationssaumiccraft@saumiccraft.in"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.format());
  process.exit(1);
}

const env = parsed.data;

export default env;
