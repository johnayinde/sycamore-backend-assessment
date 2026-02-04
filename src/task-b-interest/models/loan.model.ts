import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * Loan attributes interface
 */
interface LoanAttributes {
  id: string;
  userId: string;
  principalAmount: string; // Using string to preserve decimal precision
  interestRate: string; // Annual interest rate (e.g., "0.275" for 27.5%)
  startDate: Date;
  status: 'ACTIVE' | 'PAID' | 'DEFAULTED';
  createdAt?: Date;
  updatedAt?: Date;
}

interface LoanCreationAttributes extends Optional<LoanAttributes, 'id' | 'status'> {}

/**
 * Loan Model
 * Represents a loan with principal amount and interest rate
 */
class Loan extends Model<LoanAttributes, LoanCreationAttributes> implements LoanAttributes {
  public id!: string;
  public userId!: string;
  public principalAmount!: string;
  public interestRate!: string;
  public startDate!: Date;
  public status!: 'ACTIVE' | 'PAID' | 'DEFAULTED';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Loan.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'User who took the loan',
    },
    principalAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Loan principal amount',
    },
    interestRate: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      comment: 'Annual interest rate (e.g., 0.2750 for 27.5%)',
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Loan start date',
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'PAID', 'DEFAULTED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  },
  {
    sequelize,
    tableName: 'loans',
    timestamps: true,
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export default Loan;
