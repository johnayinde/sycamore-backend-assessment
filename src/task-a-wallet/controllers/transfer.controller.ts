import { Request, Response } from "express";
import { WalletService } from "../services/wallet.service";
import { AppError } from "../../utils/error-handler";
import { sendSuccess, responses } from "../../utils/response-handler";

/**
 * TransferController
 * Handles HTTP requests for wallet transfer operations
 */
export class TransferController {
  /**
   * Process a transfer between wallets
   * POST /api/transfer
   */
  static async transfer(req: Request, res: Response): Promise<void> {
    const { fromUserId, toUserId, amount, description, idempotencyKey } =
      req.body;

    // Validate required fields
    if (!fromUserId || !toUserId || !amount || !idempotencyKey) {
      throw new AppError(
        "Missing required fields: fromUserId, toUserId, amount, idempotencyKey",
        400,
      );
    }

    // Validate that users are different
    if (fromUserId === toUserId) {
      throw new AppError("Cannot transfer to the same wallet", 400);
    }

    // Process the transfer
    const result = await WalletService.processTransfer({
      fromUserId,
      toUserId,
      amount: parseFloat(amount),
      description,
      idempotencyKey,
    });

    sendSuccess(res, result);
  }

  /**
   * Create a new wallet
   * POST /api/wallets
   */
  static async createWallet(req: Request, res: Response): Promise<void> {
    const { userId, initialBalance = 0 } = req.body;

    if (!userId) {
      throw new AppError("userId is required", 400);
    }

    const wallet = await WalletService.createWallet(
      userId,
      parseFloat(initialBalance),
    );

    responses.created(res, {
      walletId: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance,
    });
  }

  /**
   * Get wallet details by user ID
   * GET /api/wallets/:userId
   */
  static async getWallet(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    const wallet = await WalletService.getWalletByUserId(userId);

    sendSuccess(res, {
      walletId: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance,
    });
  }

  /**
   * Get transaction history for a user
   * GET /api/wallets/:userId/history
   */
  static async getHistory(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    const transactions = await WalletService.getTransactionHistory(userId);

    sendSuccess(res, {
      transactions,
      count: transactions.length,
    });
  }
}
