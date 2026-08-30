import crypto from "crypto";
import AppError from "../utils/app-error.js";

const CSRF_TOKEN_NAME = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function setCsrfCookie(res) {
  const token = generateToken();
  res.cookie(CSRF_TOKEN_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  });
  return token;
}

export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies[CSRF_TOKEN_NAME];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken) {
    return next(new AppError("CSRF token missing", 403));
  }

  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    return next(new AppError("CSRF token invalid", 403));
  }

  next();
}
