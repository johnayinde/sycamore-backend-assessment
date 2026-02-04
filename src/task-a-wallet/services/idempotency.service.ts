import TransactionLog, {
  TransactionLogStatus,
} from "../models/transaction-log.model";
import { AppError } from "../../utils/error-handler";

/**
 * IdempotencyService
 * Handles idempotency key management to prevent duplicate transactions
 */
export class IdempotencyService {
  /**
   * Check if an idempotency key exists and return its status
   * @param idempotencyKey - Unique key for the request
   * @returns TransactionLog if exists, null otherwise
   */
  static async checkIdempotencyKey(
    idempotencyKey: string,
  ): Promise<TransactionLog | null> {
    return await TransactionLog.findOne({
      where: { idempotencyKey },
    });
  }

  /**
   * Create a new transaction log entry with PENDING status
   * This acts as a distributed lock
   * @param idempotencyKey - Unique key for the request
   * @param requestPayload - The original request data
   * @returns Created TransactionLog
   */
  static async createPendingLog(
    idempotencyKey: string,
    requestPayload: object,
  ): Promise<TransactionLog> {
    try {
      return await TransactionLog.create({
        idempotencyKey,
        status: TransactionLogStatus.PENDING,
        requestPayload,
      });
    } catch (error: any) {
      // If unique constraint violation, another request is processing
      if (error.name === "SequelizeUniqueConstraintError") {
        throw new AppError(
          "Request is already being processed. Please wait.",
          409,
        );
      }
      throw error;
    }
  }

  /**
   * Update transaction log to COMPLETED status
   * @param idempotencyKey - The idempotency key
   * @param transactionId - ID of the completed transaction
   * @param responsePayload - Response data to store
   */
  static async markAsCompleted(
    idempotencyKey: string,
    transactionId: string,
    responsePayload: object,
  ): Promise<void> {
    await TransactionLog.update(
      {
        status: TransactionLogStatus.COMPLETED,
        transactionId,
        responsePayload,
      },
      {
        where: { idempotencyKey },
      },
    );
  }

  /**
   * Update transaction log to FAILED status
   * @param idempotencyKey - The idempotency key
   * @param errorMessage - Error message to store
   */
  static async markAsFailed(
    idempotencyKey: string,
    errorMessage: string,
  ): Promise<void> {
    await TransactionLog.update(
      {
        status: TransactionLogStatus.FAILED,
        errorMessage,
      },
      {
        where: { idempotencyKey },
      },
    );
  }

  /**
   * Clean up old transaction logs
   * Remove logs older than 24 hours with COMPLETED or FAILED status
   */
  static async cleanupOldLogs(hoursOld: number = 24): Promise<number> {
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

    const deleted = await TransactionLog.destroy({
      where: {
        status: [TransactionLogStatus.COMPLETED, TransactionLogStatus.FAILED],
        createdAt: {
          [require("sequelize").Op.lt]: cutoffDate,
        },
      },
    });

    return deleted;
  }
}
