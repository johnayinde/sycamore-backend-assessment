import { Transaction as SequelizeTransaction } from 'sequelize';
import sequelize from '../../config/database';
import Wallet from '../models/wallet.model';
import Transaction, { TransactionType, TransactionStatus } from '../models/transaction.model';
import { AppError } from '../../utils/error-handler';
import { v4 as uuidv4 } from 'uuid';
import { IdempotencyService } from './idempotency.service';

/**
 * Transfer request interface
 */
export interface TransferRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  description?: string;
  idempotencyKey: string;
}

/**
 * Transfer response interface
 */
export interface TransferResponse {
  transactionId: string;
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  status: string;
  reference: string;
  message: string;
}

/**
 * WalletService
 * Handles wallet operations with proper transaction management
 * and race condition prevention
 */
export class WalletService {
  /**
   * Process a transfer between two wallets with idempotency
   * This is the main method that prevents double-spending and race conditions
   * 
   * @param request - Transfer request details
   * @returns Transfer response
   */
  static async processTransfer(request: TransferRequest): Promise<TransferResponse> {
    const { fromUserId, toUserId, amount, description, idempotencyKey } = request;

    // Validate amount
    if (amount <= 0) {
      throw new AppError('Transfer amount must be greater than 0', 400);
    }

    // Step 1: Check if this idempotency key already exists
    const existingLog = await IdempotencyService.checkIdempotencyKey(idempotencyKey);

    if (existingLog) {
      // If it's completed, return the stored response
      if (existingLog.status === 'COMPLETED') {
        return existingLog.responsePayload as TransferResponse;
      }

      // If it's still pending, reject to prevent concurrent processing
      if (existingLog.status === 'PENDING') {
        throw new AppError('This transaction is already being processed', 409);
      }

      // If it failed before, we can retry by continuing
      // (or throw error if you want to prevent retries)
    }

    // Step 2: Create PENDING transaction log BEFORE starting the transfer
    // This acts as a distributed lock
    await IdempotencyService.createPendingLog(idempotencyKey, request);

    try {
      // Step 3: Execute the transfer in a database transaction
      const result = await sequelize.transaction(
        {
          isolationLevel: SequelizeTransaction.ISOLATION_LEVELS.SERIALIZABLE,
        },
        async (t: SequelizeTransaction) => {
          // Lock and fetch source wallet
          const fromWallet = await Wallet.findOne({
            where: { userId: fromUserId },
            lock: t.LOCK.UPDATE, // Pessimistic locking to prevent race conditions
            transaction: t,
          });

          if (!fromWallet) {
            throw new AppError('Source wallet not found', 404);
          }

          // Lock and fetch destination wallet
          const toWallet = await Wallet.findOne({
            where: { userId: toUserId },
            lock: t.LOCK.UPDATE,
            transaction: t,
          });

          if (!toWallet) {
            throw new AppError('Destination wallet not found', 404);
          }

          // Check sufficient balance
          if (parseFloat(fromWallet.balance.toString()) < amount) {
            throw new AppError('Insufficient balance', 400);
          }

          // Generate unique reference for this transaction
          const reference = `TXN-${uuidv4().substring(0, 8).toUpperCase()}`;

          // Create transaction record with PENDING status
          const transaction = await Transaction.create(
            {
              fromWalletId: fromWallet.id,
              toWalletId: toWallet.id,
              amount,
              type: TransactionType.TRANSFER,
              status: TransactionStatus.PENDING,
              reference,
              description: description || `Transfer from ${fromUserId} to ${toUserId}`,
            },
            { transaction: t }
          );

          // Deduct from source wallet
          await fromWallet.decrement('balance', {
            by: amount,
            transaction: t,
          });

          // Credit to destination wallet
          await toWallet.increment('balance', {
            by: amount,
            transaction: t,
          });

          // Mark transaction as COMPLETED
          await transaction.update(
            { status: TransactionStatus.COMPLETED },
            { transaction: t }
          );

          // Return transaction details
          return {
            transactionId: transaction.id,
            fromWalletId: fromWallet.id,
            toWalletId: toWallet.id,
            amount,
            status: TransactionStatus.COMPLETED,
            reference,
            message: 'Transfer completed successfully',
          };
        }
      );

      // Step 4: Mark idempotency log as COMPLETED
      await IdempotencyService.markAsCompleted(idempotencyKey, result.transactionId, result);

      return result;
    } catch (error: any) {
      // Step 5: Mark idempotency log as FAILED
      await IdempotencyService.markAsFailed(idempotencyKey, error.message);
      throw error;
    }
  }

  /**
   * Create a new wallet for a user
   * @param userId - User identifier
   * @param initialBalance - Starting balance (default 0)
   * @returns Created wallet
   */
  static async createWallet(userId: string, initialBalance: number = 0): Promise<Wallet> {
    try {
      return await Wallet.create({
        userId,
        balance: initialBalance,
      });
    } catch (error: any) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new AppError('Wallet already exists for this user', 409);
      }
      throw error;
    }
  }

  /**
   * Get wallet by user ID
   * @param userId - User identifier
   * @returns Wallet details
   */
  static async getWalletByUserId(userId: string): Promise<Wallet> {
    const wallet = await Wallet.findOne({ where: { userId } });
    
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }

    return wallet;
  }

  /**
   * Get transaction history for a wallet
   * @param userId - User identifier
   * @returns Array of transactions
   */
  static async getTransactionHistory(userId: string): Promise<Transaction[]> {
    const wallet = await this.getWalletByUserId(userId);

    return await Transaction.findAll({
      where: {
        [require('sequelize').Op.or]: [
          { fromWalletId: wallet.id },
          { toWalletId: wallet.id },
        ],
      },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
  }
}
