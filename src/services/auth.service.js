import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

import User from "../models/user.model.js";
import OtpToken from "../models/otp-token.model.js";
import AppError from "../utils/app-error.js";
import env from "../config/env.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
});

export function normalizeUid(uidString) {
  if (typeof uidString !== "string") {
    throw new AppError("Invalid UID format", 400);
  }

  const cleaned = uidString.trim().toUpperCase();

  if (!/^UID\d+$/.test(cleaned)) {
    throw new AppError("Invalid UID format", 400);
  }

  const numericUid = Number(cleaned.slice(3));

  if (!Number.isSafeInteger(numericUid)) {
    throw new AppError("Invalid UID format", 400);
  }

  return numericUid;
}

function formatUserData(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.primaryContact,
    uid: user.uid,
    role: user.role,
    enrollmentIdAmazon: user.enrollmentIdAmazon,
    enrollmentIdWebsite: user.enrollmentIdWebsite,
    enrollmentIdEtsy: user.enrollmentIdEtsy,
  };
}

function parseExpiresIn(str) {
  const match = String(str).match(/^(\d+)([smhd])$/);

  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const num = Number(match[1]);

  switch (match[2]) {
    case "s":
      return num * 1000;
    case "m":
      return num * 60 * 1000;
    case "h":
      return num * 60 * 60 * 1000;
    case "d":
      return num * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

export function generateAuthToken(user) {
  if (!Number.isInteger(user.tokenVersion)) {
    throw new AppError("Account session version is missing or invalid", 500);
  }

  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );
}

function getAuthCookieOptions() {
  const isProduction = env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    ...(isProduction ? { domain: "starsellingz.com" } : {}),
  };
}

export function setAuthCookie(res, token) {
  res.cookie("token", token, {
    ...getAuthCookieOptions(),
    maxAge: parseExpiresIn(env.JWT_EXPIRES_IN),
  });
}

export function clearAuthCookie(res) {
  res.clearCookie("token", getAuthCookieOptions());
}

export async function login(uid, password) {
  const numericUid = normalizeUid(uid);

  const user = await User.findOne({ uid: numericUid }).select(
    "+password +tokenVersion",
  );

  if (!user) {
    throw new AppError("User not found with this UID", 401);
  }

  // Preserves your existing password comparison.
  if (user.password !== password) {
    throw new AppError("Invalid password", 401);
  }

  return user;
}

export async function generateOtp(user) {
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = await bcrypt.hash(otpCode, 10);

  await OtpToken.findOneAndDelete({ user: user._id });

  const otpRecord = await OtpToken.create({
    user: user._id,
    otp: hashedOtp,
    expiresAt: new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000),
  });

  const recipientList =
    user.role === "manager" ? env.MANAGER_OTP_EMAILS : env.DEFAULT_OTP_EMAILS;

  const recipients = recipientList
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  const mailOptions = {
    from: env.EMAIL_USER,
    to: recipients.join(", "),
    subject: `Your OTP Code - ${user.name}`,
    text: [
      `Hi ${user.name},`,
      "",
      `Your verification code is: ${otpCode}`,
      "",
      `This code expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
      "If you did not request this code, please ignore this email.",
    ].join("\n"),
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Failed to send OTP email:", err.message);

    await OtpToken.deleteOne({ _id: otpRecord._id });

    throw new AppError("Unable to send OTP. Please try again.", 503);
  }
}

export async function verifyOtp(uid, otp) {
  const numericUid = normalizeUid(uid);

  if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    throw new AppError("Invalid or expired OTP", 401);
  }

  const user = await User.findOne({ uid: numericUid }).select("+tokenVersion");

  if (!user) {
    throw new AppError("User not found with this UID", 401);
  }

  const otpRecord = await OtpToken.findOne({ user: user._id });

  if (!otpRecord) {
    throw new AppError("Invalid or expired OTP", 401);
  }

  if (otpRecord.expiresAt <= new Date()) {
    await OtpToken.deleteOne({ _id: otpRecord._id });
    throw new AppError("Invalid or expired OTP", 401);
  }

  const isMatch = await bcrypt.compare(otp, otpRecord.otp);

  if (!isMatch) {
    throw new AppError("Invalid or expired OTP", 401);
  }

  const token = generateAuthToken(user);

  // Only one verification request can consume this OTP.
  const consumed = await OtpToken.deleteOne({
    _id: otpRecord._id,
    expiresAt: { $gt: new Date() },
  });

  if (consumed.deletedCount !== 1) {
    throw new AppError("Invalid or expired OTP", 401);
  }

  return { user, token };
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 401);
  }

  return formatUserData(user);
}

export async function invalidateSessions(userId) {
  await User.findByIdAndUpdate(userId, {
    $inc: { tokenVersion: 1 },
  });
}

export { formatUserData };
