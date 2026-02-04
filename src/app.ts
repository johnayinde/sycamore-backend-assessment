import express, { Application, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import "express-async-errors";

import sequelize, { testConnection } from "./config/database";
import { connectRedis } from "./config/redis";
import { errorHandler } from "./utils/error-handler";
import logger from "./utils/logger";

// Import routes
import walletRoutes from "./task-a-wallet/routes/wallet.routes";
import interestRoutes from "./task-b-interest/routes/interest.routes";

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Sycamore Backend Assessment API is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api", walletRoutes);
app.use("/api", interestRoutes);

// 404 handler
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use(errorHandler);

/**
 * Initialize database and start server
 */
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Connect to Redis
    await connectRedis();

    // Sync models (in production, use migrations instead)
    if (process.env.NODE_ENV !== "production") {
      await sequelize.sync({ alter: false });
      logger.info("Database models synchronized");
    }

    // Start server
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info("\nAvailable Endpoints:");
      logger.info("\nTask A - Wallet Operations:");
      logger.info("  POST   /api/transfer");
      logger.info("  POST   /api/wallets");
      logger.info("  GET    /api/wallets/:userId");
      logger.info("  GET    /api/wallets/:userId/history");
      logger.info("\nTask B - Interest Calculator:");
      logger.info("  POST   /api/calculate-interest");
      logger.info("  POST   /api/calculate-interest/range");
      logger.info("  POST   /api/loans");
      logger.info("  GET    /api/loans/:loanId/accumulated-interest");
    });
  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught Exception", { error });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: any) => {
  logger.error("Unhandled Rejection", { reason });
  process.exit(1);
});

// Start the server
startServer();

export default app;
