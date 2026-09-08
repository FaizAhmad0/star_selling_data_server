import crypto from "crypto";
import AppError from "../utils/app-error.js";

const CSRF_TOKEN_NAME = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

function getCsrfCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    ...(isProduction ? { domain: "starsellingz.com" } : {}),
  };
}

export function setCsrfCookie(res) {
  const token = crypto.randomBytes(32).toString("hex");

  res.cookie(CSRF_TOKEN_NAME, token, getCsrfCookieOptions());

  return token;
}

export function clearCsrfCookie(res) {
  res.clearCookie(CSRF_TOKEN_NAME, getCsrfCookieOptions());
}

export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_TOKEN_NAME];
  const headerToken = req.headers[CSRF_HEADER];

  if (
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    !cookieToken ||
    !headerToken
  ) {
    return next(new AppError("CSRF token missing", 403));
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  if (
    cookieBuffer.length !== headerBuffer.length ||
    !crypto.timingSafeEqual(cookieBuffer, headerBuffer)
  ) {
    return next(new AppError("CSRF token invalid", 403));
  }

  return next();
}
