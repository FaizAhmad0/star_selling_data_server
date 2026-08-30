import app from "./app.js";
import env from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";

let server;

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err.message);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message);
  process.exit(1);
});

const startServer = async () => {
  await connectDatabase();

  server = app.listen(env.PORT, () => {
    console.log(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });

  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`${signal} received. Shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      console.error("Forced exit after timeout");
      process.exit(1);
    }, 10000);
    forceExit.unref();

    try {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      console.log("HTTP server closed.");

      await disconnectDatabase();

      process.exit(0);
    } catch (error) {
      console.error("Shutdown error:", error.message);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
