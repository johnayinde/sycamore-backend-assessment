import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * TransactionLog status
 */
export enum TransactionLogStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * TransactionLog attributes interface
 */
interface TransactionLogAttributes {
  id: string;
  idempotencyKey: string;
  status: TransactionLogStatus;
  transactionId?: string | null;
  requestPayload: object;
  responsePayload?: object | null;
  errorMessage?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface TransactionLogCreationAttributes
  extends Optional<TransactionLogAttributes, 'id' | 'transactionId' | 'responsePayload' | 'errorMessage'> {}

/**
 * TransactionLog Model
 * Tracks idempotency keys to prevent duplicate transaction processing
 * Created BEFORE the transaction begins to act as a distributed lock
 */
class TransactionLog extends Model<TransactionLogAttributes, TransactionLogCreationAttributes>
  implements TransactionLogAttributes {
  public id!: string;
  public idempotencyKey!: string;
  public status!: TransactionLogStatus;
  public transactionId!: string | null;
  public requestPayload!: object;
  public responsePayload!: object | null;
  public errorMessage!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

TransactionLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    idempotencyKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Unique key to prevent duplicate requests',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TransactionLogStatus)),
      allowNull: false,
      defaultValue: TransactionLogStatus.PENDING,
    },
    transactionId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Reference to the completed transaction',
    },
    requestPayload: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Original request data',
    },
    responsePayload: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Response data after completion',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Error message if transaction failed',
    },
  },
  {
    sequelize,
    tableName: 'transaction_logs',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['idempotencyKey'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['createdAt'],
      },
    ],
  }
);

export default TransactionLog;
