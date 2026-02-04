import { Response } from "express";
import logger from "./logger";

interface SuccessResponse {
  status: "success";
  data?: any;
  message?: string;
  meta?: any;
}

interface ErrorResponse {
  status: "error";
  message: string;
  errors?: any;
  code?: string;
}

/**
 * Send a standardized success response
 */
export const sendSuccess = (
  res: Response,
  data?: any,
  message?: string,
  statusCode: number = 200,
  meta?: any,
): void => {
  const response: SuccessResponse = {
    status: "success",
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
};

/**
 * Send a standardized error response
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  errors?: any,
  code?: string,
): void => {
  const response: ErrorResponse = {
    status: "error",
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  if (code) {
    response.code = code;
  }

  // Log error details for internal tracking
  if (statusCode >= 500) {
    logger.error(`Server Error [${statusCode}]: ${message}`, { errors, code });
  } else if (statusCode >= 400) {
    logger.warn(`Client Error [${statusCode}]: ${message}`, { errors, code });
  }

  res.status(statusCode).json(response);
};

/**
 * Common response helpers for specific scenarios
 */
export const responses = {
  created: (
    res: Response,
    data?: any,
    message: string = "Resource created successfully",
  ) => sendSuccess(res, data, message, 201),

  badRequest: (res: Response, message: string = "Bad request", errors?: any) =>
    sendError(res, message, 400, errors, "BAD_REQUEST"),

  unauthorized: (res: Response, message: string = "Unauthorized access") =>
    sendError(res, message, 401, undefined, "UNAUTHORIZED"),

  forbidden: (res: Response, message: string = "Access forbidden") =>
    sendError(res, message, 403, undefined, "FORBIDDEN"),

  notFound: (res: Response, message: string = "Resource not found") =>
    sendError(res, message, 404, undefined, "NOT_FOUND"),

  conflict: (
    res: Response,
    message: string = "Resource conflict",
    errors?: any,
  ) => sendError(res, message, 409, errors, "CONFLICT"),

  validationError: (
    res: Response,
    errors: any,
    message: string = "Validation failed",
  ) => sendError(res, message, 422, errors, "VALIDATION_ERROR"),

  serverError: (res: Response, message: string = "Internal server error") =>
    sendError(res, message, 500, undefined, "INTERNAL_ERROR"),
};
