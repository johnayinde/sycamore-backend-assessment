import { Request, Response, NextFunction } from "express";
import logger from "./logger";
import { sendError } from "./response-handler";

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    logger.warn(`AppError on ${req.method} ${req.path}: ${err.message}`, {
      statusCode: err.statusCode,
      code: err.code,
      stack: err.stack,
    });
    sendError(res, err.message, err.statusCode, undefined, err.code);
    return;
  }

  // Handle Sequelize validation errors
  if (err.name === "SequelizeValidationError") {
    logger.warn(`Validation error on ${req.method} ${req.path}`, {
      error: err.message,
    });
    sendError(res, "Validation error", 400, err.message, "VALIDATION_ERROR");
    return;
  }

  // Handle Sequelize unique constraint errors
  if (err.name === "SequelizeUniqueConstraintError") {
    logger.warn(`Unique constraint violation on ${req.method} ${req.path}`, {
      error: err.message,
    });
    sendError(
      res,
      "Resource already exists",
      409,
      err.message,
      "DUPLICATE_RESOURCE",
    );
    return;
  }

  // Handle unexpected errors
  logger.error(`Unexpected error on ${req.method} ${req.path}`, {
    error: err.message,
    stack: err.stack,
  });
  sendError(res, "Internal server error", 500);
};

/**
 * Async wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
