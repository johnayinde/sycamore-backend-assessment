import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Transaction types
 */
export enum TransactionType {
  TRANSFER = 'TRANSFER',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Transaction attributes interface
 */
interface TransactionAttributes {
  id: string;
  fromWalletId: string | null;
  toWalletId: string | null;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  reference: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TransactionCreationAttributes extends Optional<TransactionAttributes, 'id' | 'description'> {}

/**
 * Transaction Model
 * Records all wallet transactions with complete audit trail
 */
class Transaction extends Model<TransactionAttributes, TransactionCreationAttributes>
  implements TransactionAttributes {
  public id!: string;
  public fromWalletId!: string | null;
  public toWalletId!: string | null;
  public amount!: number;
  public type!: TransactionType;
  public status!: TransactionStatus;
  public reference!: string;
  public description?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Transaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fromWalletId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Source wallet ID (null for deposits)',
    },
    toWalletId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Destination wallet ID (null for withdrawals)',
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
      comment: 'Transaction amount',
    },
    type: {
      type: DataTypes.ENUM(...Object.values(TransactionType)),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TransactionStatus)),
      allowNull: false,
      defaultValue: TransactionStatus.PENDING,
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Unique reference for this transaction',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'transactions',
    timestamps: true,
    indexes: [
      {
        fields: ['fromWalletId'],
      },
      {
        fields: ['toWalletId'],
      },
      {
        unique: true,
        fields: ['reference'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export default Transaction;
