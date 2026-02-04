import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Wallet attributes interface
 */
interface WalletAttributes {
  id: string;
  userId: string;
  balance: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface WalletCreationAttributes extends Optional<WalletAttributes, 'id'> {}

/**
 * Wallet Model
 * Represents a user's wallet with a balance
 */
class Wallet extends Model<WalletAttributes, WalletCreationAttributes> implements WalletAttributes {
  public id!: string;
  public userId!: string;
  public balance!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Wallet.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'User identifier',
    },
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0, // Prevent negative balances
      },
      comment: 'Current wallet balance',
    },
  },
  {
    sequelize,
    tableName: 'wallets',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['userId'],
      },
    ],
  }
);

export default Wallet;
