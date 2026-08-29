import { verifyToken } from "../utils/jwt.js";
import AppError from "../utils/app-error.js";

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Authentication required", 401));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (_error) {
    return next(new AppError("Invalid or expired token", 401));
  }
};

export default authenticate;
