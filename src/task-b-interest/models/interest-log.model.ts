import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';

/**
 * InterestLog attributes interface
 */
interface InterestLogAttributes {
  id: string;
  loanId: string;
  calculationDate: Date;
  principalAmount: string; // Using string to preserve decimal precision
  dailyInterestRate: string;
  dailyInterestAmount: string;
  accumulatedInterest: string;
  daysInYear: number;
  createdAt?: Date;
}

interface InterestLogCreationAttributes extends Optional<InterestLogAttributes, 'id'> {}

/**
 * InterestLog Model
 * Records daily interest calculations with full precision
 */
class InterestLog extends Model<InterestLogAttributes, InterestLogCreationAttributes>
  implements InterestLogAttributes {
  public id!: string;
  public loanId!: string;
  public calculationDate!: Date;
  public principalAmount!: string;
  public dailyInterestRate!: string;
  public dailyInterestAmount!: string;
  public accumulatedInterest!: string;
  public daysInYear!: number;
  public readonly createdAt!: Date;
}

InterestLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    loanId: {
      type: DataTypes.UUID,
      allowNull: false,
      comment: 'Reference to the loan',
    },
    calculationDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: 'Date for which interest was calculated',
    },
    principalAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Principal amount at time of calculation',
    },
    dailyInterestRate: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: false,
      comment: 'Daily interest rate used',
    },
    dailyInterestAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Interest accrued for this day',
    },
    accumulatedInterest: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      comment: 'Total accumulated interest up to this date',
    },
    daysInYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Number of days in the year (365 or 366)',
    },
  },
  {
    sequelize,
    tableName: 'interest_logs',
    timestamps: true,
    updatedAt: false, // Interest logs should not be updated once created
    indexes: [
      {
        fields: ['loanId'],
      },
      {
        fields: ['calculationDate'],
      },
      {
        unique: true,
        fields: ['loanId', 'calculationDate'],
      },
    ],
  }
);

export default InterestLog;
