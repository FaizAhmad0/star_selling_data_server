import { verifyToken } from "../utils/jwt.js";
import User from "../models/user.model.js";
import AppError from "../utils/app-error.js";

const authenticate = async (req, res, next) => {
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    return next(new AppError("Authentication required", 401));
  }

  try {
    const decoded = await verifyToken(token);

    const user = await User.findById(decoded.id)
      .select("role +tokenVersion")
      .lean();

    if (!user) {
      return next(new AppError("User no longer exists", 401));
    }

    if (
      !Number.isInteger(user.tokenVersion) ||
      !Number.isInteger(decoded.tokenVersion) ||
      user.tokenVersion !== decoded.tokenVersion
    ) {
      return next(
        new AppError("Session invalidated. Please log in again", 401),
      );
    }

    req.user = {
      ...decoded,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    return next();
  } catch (error) {
    console.error("Authentication failed:", error.message);

    return next(new AppError("Invalid or expired token", 401));
  }
};

export default authenticate;
