const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = [];

  if (err.isOperational) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors: err.details ? [err.details] : [],
    });
  }

  if (err.name === "ZodError") {
    statusCode = 400;
    message = "Validation error";
    errors = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return res.status(statusCode).json({ success: false, message, errors });
  }

  if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    message = "Validation error";
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(statusCode).json({ success: false, message, errors });
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
    return res.status(statusCode).json({ success: false, message, errors });
  }

  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for ${field}`;
    return res.status(statusCode).json({ success: false, message, errors });
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
    return res.status(statusCode).json({ success: false, message, errors });
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
    return res.status(statusCode).json({ success: false, message, errors });
  }

  console.error("Unhandled error:", err);
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : message,
    errors,
  });
};

export default errorHandler;
