import express from "express";
import cors from "cors";
import helmet from "helmet";
import env from "./config/env.js";
import notFound from "./middlewares/not-found.middleware.js";
import errorHandler from "./middlewares/error.middleware.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/v1/health", async (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is healthy",
  });
});

app.use("/api/v1/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
