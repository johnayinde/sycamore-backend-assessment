import { Router } from 'express';
import { TransferController } from '../controllers/transfer.controller';
import { asyncHandler } from '../../utils/error-handler';

const router = Router();

/**
 * @route   POST /api/transfer
 * @desc    Transfer funds between wallets with idempotency
 * @access  Public (should be protected in production)
 */
router.post('/transfer', asyncHandler(TransferController.transfer));

/**
 * @route   POST /api/wallets
 * @desc    Create a new wallet
 * @access  Public (should be protected in production)
 */
router.post('/wallets', asyncHandler(TransferController.createWallet));

/**
 * @route   GET /api/wallets/:userId
 * @desc    Get wallet details by user ID
 * @access  Public (should be protected in production)
 */
router.get('/wallets/:userId', asyncHandler(TransferController.getWallet));

/**
 * @route   GET /api/wallets/:userId/history
 * @desc    Get transaction history for a user
 * @access  Public (should be protected in production)
 */
router.get('/wallets/:userId/history', asyncHandler(TransferController.getHistory));

export default router;
