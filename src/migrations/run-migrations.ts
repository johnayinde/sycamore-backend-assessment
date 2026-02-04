import sequelize from "../config/database";
import logger from "../utils/logger";
import Wallet from "../task-a-wallet/models/wallet.model";
import Transaction from "../task-a-wallet/models/transaction.model";
import TransactionLog from "../task-a-wallet/models/transaction-log.model";
import Loan from "../task-b-interest/models/loan.model";
import InterestLog from "../task-b-interest/models/interest-log.model";

/**
 * Run database migrations
 * This script creates all necessary tables
 */
async function runMigrations() {
  try {
    logger.info("Running database migrations...");

    // Test connection
    await sequelize.authenticate();
    logger.info("Database connection established");

    // Sync models in the correct order (dependencies first)
    await Wallet.sync({ force: false });
    logger.info("Wallets table created/verified");

    await Transaction.sync({ force: false });
    logger.info("Transactions table created/verified");

    await TransactionLog.sync({ force: false });
    logger.info("Transaction logs table created/verified");

    await Loan.sync({ force: false });
    logger.info("Loans table created/verified");

    await InterestLog.sync({ force: false });
    logger.info("Interest logs table created/verified");

    logger.info("All migrations completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("Migration failed", { error });
    process.exit(1);
  }
}

runMigrations();
