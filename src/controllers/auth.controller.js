import * as authService from "../services/auth.service.js";
import { sendSuccess } from "../utils/response.js";
import asyncHandler from "../utils/async-handler.js";
import { setCsrfCookie } from "../middlewares/csrf.middleware.js";

export const login = asyncHandler(async (req, res) => {
  const { uid, password } = req.body;

  const user = await authService.login(uid, password);

  if (user.role === "user") {
    const token = authService.generateAuthToken(user);
    authService.setAuthCookie(res, token);
    setCsrfCookie(res);

    return sendSuccess(res, {
      message: "Login successful",
      data: authService.formatUserData(user),
    });
  }

  await authService.generateOtp(user);

  return sendSuccess(res, {
    message: "OTP sent successfully",
    data: { requiresOtp: true, uid: user.uid },
  });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { uid, otp } = req.body;

  const { user, token } = await authService.verifyOtp(uid, otp);
  authService.setAuthCookie(res, token);
  setCsrfCookie(res);

  return sendSuccess(res, {
    message: "OTP verified and login successful",
    data: authService.formatUserData(user),
  });
});

export const logout = asyncHandler(async (req, res) => {
  if (req.user && req.user.id) {
    await authService.invalidateSessions(req.user.id);
  }
  authService.clearAuthCookie(res);
  res.clearCookie("csrf_token", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/",
  });

  return sendSuccess(res, {
    message: "Logged out successfully",
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);

  return sendSuccess(res, {
    message: "User retrieved successfully",
    data: user,
  });
});
