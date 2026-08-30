import AppError from "../utils/app-error.js";

const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user || !req.user.role || !allowedRoles.includes(req.user.role)) {
      return next(new AppError("Insufficient permissions", 403));
    }
    next();
  };
};

export default authorize;
