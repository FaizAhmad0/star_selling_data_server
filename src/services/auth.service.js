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
  const cleaned = uidString.trim().toUpperCase();
  if (!cleaned.startsWith("UID")) {
    throw new AppError("Invalid UID format", 400);
  }
  const numStr = cleaned.slice(3);
  if (!/^\d+$/.test(numStr)) {
    throw new AppError("Invalid UID format", 400);
  }
  return Number(numStr);
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
  const match = str.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return num * 1000;
    case "m": return num * 60 * 1000;
    case "h": return num * 60 * 60 * 1000;
    case "d": return num * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

export function generateAuthToken(user) {
  return jwt.sign({ id: user._id, role: user.role, tokenVersion: user.tokenVersion }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export function setAuthCookie(res, token) {
  const isProduction = env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: parseExpiresIn(env.JWT_EXPIRES_IN),
    path: "/",
  });
}

export async function login(uid, password) {
  const numericUid = normalizeUid(uid);

  const user = await User.findOne({ uid: numericUid }).select("+password");
  if (!user) {
    throw new AppError("User not found with this UID", 401);
  }

  if (user.password !== password) {
    throw new AppError("Invalid password", 401);
  }

  return user;
}

export async function generateOtp(user) {
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const hashedOtp = await bcrypt.hash(otpCode, 10);

  await OtpToken.findOneAndDelete({ user: user._id });

  await OtpToken.create({
    user: user._id,
    otp: hashedOtp,
    expiresAt: new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000),
  });

  let recipients;
  if (user.role === "manager") {
    recipients = env.MANAGER_OTP_EMAILS.split(",").map((e) => e.trim());
  } else {
    recipients = env.DEFAULT_OTP_EMAILS.split(",").map((e) => e.trim());
  }

  const mailOptions = {
    from: env.EMAIL_USER,
    to: recipients.join(", "),
    subject: `Your OTP Code - ${user.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
        <h2 style="color: #333;">Verification Code</h2>
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Your OTP code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #000; background: #f5f5f5; padding: 16px; text-align: center; border-radius: 8px; margin: 16px 0;">
          ${otpCode}
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in ${env.OTP_EXPIRY_MINUTES} minutes.</p>
        <p style="color: #999; font-size: 12px;">If you did not request this code, please ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (_err) {
    console.error("Failed to send OTP email:", _err.message);
  }
}

export async function verifyOtp(uid, otp) {
  const numericUid = normalizeUid(uid);

  const user = await User.findOne({ uid: numericUid }).select("+password");
  if (!user) {
    throw new AppError("User not found with this UID", 401);
  }

  const otpRecord = await OtpToken.findOne({ user: user._id });
  if (!otpRecord) {
    throw new AppError("Invalid or expired OTP", 401);
  }

  if (otpRecord.expiresAt < new Date()) {
    await OtpToken.deleteOne({ _id: otpRecord._id });
    throw new AppError("Invalid or expired OTP", 401);
  }

  const isMatch = await bcrypt.compare(otp, otpRecord.otp);
  if (!isMatch) {
    throw new AppError("Invalid or expired OTP", 401);
  }

  await OtpToken.deleteOne({ _id: otpRecord._id });

  const token = generateAuthToken(user);

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
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
}

export function clearAuthCookie(res) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
}

export { formatUserData };
