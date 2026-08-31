import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import env from "./config/env.js";
import notFound from "./middlewares/not-found.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";
import userRoutes from "./routes/user.routes.js";
import managerRoutes from "./routes/manager.routes.js";
import supervisorRoutes from "./routes/supervisor.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { csrfProtection } from "./middlewares/csrf.middleware.js";

const app = express();

app.use(helmet({
  contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
  crossOriginEmbedderPolicy: env.NODE_ENV === "production",
}));
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/v1/health", async (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", csrfProtection, userRoutes);
app.use("/api/v1/managers", csrfProtection, managerRoutes);
app.use("/api/v1/supervisors", csrfProtection, supervisorRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
