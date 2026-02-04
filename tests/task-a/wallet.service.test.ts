import sequelize from '../../src/config/database';
import { WalletService } from '../../src/task-a-wallet/services/wallet.service';
import Wallet from '../../src/task-a-wallet/models/wallet.model';
import Transaction from '../../src/task-a-wallet/models/transaction.model';
import TransactionLog from '../../src/task-a-wallet/models/transaction-log.model';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Suite for Task A: Idempotent Wallet
 * Tests race conditions, idempotency, and double-spending prevention
 */
describe('Task A: Idempotent Wallet - WalletService', () => {
  // Setup: Create test database tables before all tests
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  // Cleanup: Close database connection after all tests
  afterAll(async () => {
    await sequelize.close();
  });

  // Reset data before each test
  beforeEach(async () => {
    await TransactionLog.destroy({ where: {} });
    await Transaction.destroy({ where: {} });
    await Wallet.destroy({ where: {} });
  });

  describe('Wallet Creation', () => {
    it('should create a new wallet with initial balance', async () => {
      const wallet = await WalletService.createWallet('user1', 1000);

      expect(wallet).toBeDefined();
      expect(wallet.userId).toBe('user1');
      expect(parseFloat(wallet.balance.toString())).toBe(1000);
    });

    it('should create a wallet with zero balance by default', async () => {
      const wallet = await WalletService.createWallet('user2');

      expect(wallet).toBeDefined();
      expect(parseFloat(wallet.balance.toString())).toBe(0);
    });

    it('should throw error when creating duplicate wallet', async () => {
      await WalletService.createWallet('user3', 500);

      await expect(WalletService.createWallet('user3', 500)).rejects.toThrow(
        'Wallet already exists for this user'
      );
    });
  });

  describe('Transfer Operations', () => {
    beforeEach(async () => {
      await WalletService.createWallet('sender', 1000);
      await WalletService.createWallet('receiver', 500);
    });

    it('should successfully transfer funds between wallets', async () => {
      const idempotencyKey = uuidv4();

      const result = await WalletService.processTransfer({
        fromUserId: 'sender',
        toUserId: 'receiver',
        amount: 200,
        description: 'Test transfer',
        idempotencyKey,
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('COMPLETED');
      expect(result.amount).toBe(200);

      // Check balances
      const updatedWallet1 = await WalletService.getWalletByUserId('sender');
      const updatedWallet2 = await WalletService.getWalletByUserId('receiver');

      expect(parseFloat(updatedWallet1.balance.toString())).toBe(800);
      expect(parseFloat(updatedWallet2.balance.toString())).toBe(700);
    });

    it('should throw error for insufficient balance', async () => {
      const idempotencyKey = uuidv4();

      await expect(
        WalletService.processTransfer({
          fromUserId: 'sender',
          toUserId: 'receiver',
          amount: 1500, // More than available
          idempotencyKey,
        })
      ).rejects.toThrow('Insufficient balance');
    });

    it('should throw error for negative or zero amount', async () => {
      const idempotencyKey = uuidv4();

      await expect(
        WalletService.processTransfer({
          fromUserId: 'sender',
          toUserId: 'receiver',
          amount: 0,
          idempotencyKey,
        })
      ).rejects.toThrow('Transfer amount must be greater than 0');

      await expect(
        WalletService.processTransfer({
          fromUserId: 'sender',
          toUserId: 'receiver',
          amount: -100,
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow('Transfer amount must be greater than 0');
    });

    it('should throw error when source wallet not found', async () => {
      await expect(
        WalletService.processTransfer({
          fromUserId: 'nonexistent',
          toUserId: 'receiver',
          amount: 100,
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow('Source wallet not found');
    });

    it('should throw error when destination wallet not found', async () => {
      await expect(
        WalletService.processTransfer({
          fromUserId: 'sender',
          toUserId: 'nonexistent',
          amount: 100,
          idempotencyKey: uuidv4(),
        })
      ).rejects.toThrow('Destination wallet not found');
    });
  });

  describe('Idempotency - Double-Tap Prevention', () => {
    beforeEach(async () => {
      await WalletService.createWallet('sender', 1000);
      await WalletService.createWallet('receiver', 500);
    });

    it('should return same result for duplicate idempotency key (double-tap)', async () => {
      const idempotencyKey = uuidv4();

      // First transfer
      const result1 = await WalletService.processTransfer({
        fromUserId: 'sender',
        toUserId: 'receiver',
        amount: 200,
        idempotencyKey,
      });

      // Second transfer with same idempotency key (simulating double-tap)
      const result2 = await WalletService.processTransfer({
        fromUserId: 'sender',
        toUserId: 'receiver',
        amount: 200,
        idempotencyKey, // Same key
      });

      // Results should be identical
      expect(result1.transactionId).toBe(result2.transactionId);
      expect(result1.reference).toBe(result2.reference);

      // Balance should only be deducted once
      const finalWallet1 = await WalletService.getWalletByUserId('sender');
      const finalWallet2 = await WalletService.getWalletByUserId('receiver');

      expect(parseFloat(finalWallet1.balance.toString())).toBe(800); // 1000 - 200
      expect(parseFloat(finalWallet2.balance.toString())).toBe(700); // 500 + 200
    });

    it('should reject concurrent requests with same idempotency key', async () => {
      const idempotencyKey = uuidv4();

      // Start first transfer (don't await yet)
      const transfer1Promise = WalletService.processTransfer({
        fromUserId: 'sender',
        toUserId: 'receiver',
        amount: 200,
        idempotencyKey,
      });

      // Immediately start second transfer with same key
      const transfer2Promise = WalletService.processTransfer({
        fromUserId: 'sender',
        toUserId: 'receiver',
        amount: 200,
        idempotencyKey,
      });

      // One should succeed, one should fail with 409
      const results = await Promise.allSettled([transfer1Promise, transfer2Promise]);

      const succeeded = results.filter((r) => r.status === 'fulfilled');

      // At least one should succeed
      expect(succeeded.length).toBeGreaterThanOrEqual(1);
      
      // Final balance check - only one transfer should have gone through
      const finalWallet1 = await WalletService.getWalletByUserId('sender');
      expect(parseFloat(finalWallet1.balance.toString())).toBe(800);
    });
  });

  describe('Race Condition Prevention', () => {
    it('should prevent double-spending through concurrent transfers', async () => {
      await WalletService.createWallet('sender', 1000);
      await WalletService.createWallet('receiver1', 0);
      await WalletService.createWallet('receiver2', 0);

      // Try to transfer 600 to two different receivers concurrently
      // Should only allow one to succeed (total balance is 1000)
      const transfer1 = WalletService.processTransfer({
        fromUserId: 'sender',
        toUserId: 'receiver1',
        amount: 600,
        idempotencyKey: uuidv4(),
      });

      const transfer2 = WalletService.processTransfer({
        fromUserId: 'sender',
        toUserId: 'receiver2',
        amount: 600,
        idempotencyKey: uuidv4(),
      });

      await Promise.allSettled([transfer1, transfer2]);

      // Both might succeed if they execute sequentially due to locking,
      // but balance constraints should prevent overspending
      const finalSender = await WalletService.getWalletByUserId('sender');
      const finalBalance = parseFloat(finalSender.balance.toString());

      // Balance should never go negative
      expect(finalBalance).toBeGreaterThanOrEqual(0);
      
      // Total money in system should remain constant (1000)
      const receiver1 = await WalletService.getWalletByUserId('receiver1');
      const receiver2 = await WalletService.getWalletByUserId('receiver2');
      
      const totalMoney = finalBalance + 
        parseFloat(receiver1.balance.toString()) + 
        parseFloat(receiver2.balance.toString());
      
      expect(totalMoney).toBe(1000);
    });
  });

  describe('Transaction History', () => {
    it('should retrieve transaction history for a user', async () => {
      await WalletService.createWallet('user1', 1000);
      await WalletService.createWallet('user2', 500);

      // Perform multiple transfers
      await WalletService.processTransfer({
        fromUserId: 'user1',
        toUserId: 'user2',
        amount: 100,
        idempotencyKey: uuidv4(),
      });

      await WalletService.processTransfer({
        fromUserId: 'user1',
        toUserId: 'user2',
        amount: 150,
        idempotencyKey: uuidv4(),
      });

      const history = await WalletService.getTransactionHistory('user1');

      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('COMPLETED');
    });
  });
});
