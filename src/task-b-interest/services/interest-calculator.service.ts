import Decimal from 'decimal.js';
import Loan from '../models/loan.model';
import InterestLog from '../models/interest-log.model';
import { AppError } from '../../utils/error-handler';

// Configure Decimal.js for precision (up to 20 decimal places)
Decimal.set({ precision: 20 });

/**
 * Interest calculation request interface
 */
export interface InterestCalculationRequest {
  loanId: string;
  calculationDate: Date;
}

/**
 * Interest calculation response interface
 */
export interface InterestCalculationResponse {
  loanId: string;
  calculationDate: string;
  principalAmount: string;
  annualInterestRate: string;
  dailyInterestRate: string;
  dailyInterestAmount: string;
  accumulatedInterest: string;
  daysInYear: number;
  isLeapYear: boolean;
}

/**
 * InterestCalculatorService
 * Calculates daily interest with mathematical precision
 * Handles leap years and uses Decimal.js to avoid floating-point errors
 */
export class InterestCalculatorService {
  /**
   * Check if a year is a leap year
   * Rules: Divisible by 4, except centuries (divisible by 100), unless divisible by 400
   * @param year - The year to check
   * @returns true if leap year, false otherwise
   */
  static isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  }

  /**
   * Get the number of days in a year
   * @param year - The year
   * @returns 365 or 366
   */
  static getDaysInYear(year: number): number {
    return this.isLeapYear(year) ? 366 : 365;
  }

  /**
   * Calculate daily interest for a loan
   * Formula: Daily Interest = Principal × (Annual Rate / Days in Year)
   * 
   * @param request - Calculation request with loan ID and date
   * @returns Detailed calculation result
   */
  static async calculateDailyInterest(
    request: InterestCalculationRequest
  ): Promise<InterestCalculationResponse> {
    const { loanId, calculationDate } = request;

    // Fetch the loan
    const loan = await Loan.findByPk(loanId);
    if (!loan) {
      throw new AppError('Loan not found', 404);
    }

    if (loan.status !== 'ACTIVE') {
      throw new AppError('Cannot calculate interest for inactive loan', 400);
    }

    // Check if calculation already exists for this date
    const existingLog = await InterestLog.findOne({
      where: {
        loanId,
        calculationDate,
      },
    });

    if (existingLog) {
      // Return existing calculation
      return {
        loanId: existingLog.loanId,
        calculationDate: existingLog.calculationDate.toISOString().split('T')[0],
        principalAmount: existingLog.principalAmount,
        annualInterestRate: loan.interestRate,
        dailyInterestRate: existingLog.dailyInterestRate,
        dailyInterestAmount: existingLog.dailyInterestAmount,
        accumulatedInterest: existingLog.accumulatedInterest,
        daysInYear: existingLog.daysInYear,
        isLeapYear: existingLog.daysInYear === 366,
      };
    }

    // Use Decimal.js for precise calculations
    const principalDecimal = new Decimal(loan.principalAmount);
    const annualRateDecimal = new Decimal(loan.interestRate);

    // Determine if it's a leap year
    const year = calculationDate.getFullYear();
    const daysInYear = this.getDaysInYear(year);
    const isLeap = this.isLeapYear(year);

    // Calculate daily interest rate: Annual Rate / Days in Year
    const dailyInterestRate = annualRateDecimal.dividedBy(daysInYear);

    // Calculate daily interest amount: Principal × Daily Rate
    const dailyInterestAmount = principalDecimal.times(dailyInterestRate);

    // Get accumulated interest up to the previous day
    const previousLog = await InterestLog.findOne({
      where: { loanId },
      order: [['calculationDate', 'DESC']],
    });

    const previousAccumulated = previousLog
      ? new Decimal(previousLog.accumulatedInterest)
      : new Decimal(0);

    // Add today's interest to accumulated
    const accumulatedInterest = previousAccumulated.plus(dailyInterestAmount);

    // Create interest log entry
    const interestLog = await InterestLog.create({
      loanId,
      calculationDate,
      principalAmount: loan.principalAmount,
      dailyInterestRate: dailyInterestRate.toFixed(8), // Store with 8 decimal precision
      dailyInterestAmount: dailyInterestAmount.toFixed(2), // Store with 2 decimal precision (cents)
      accumulatedInterest: accumulatedInterest.toFixed(2),
      daysInYear,
    });

    return {
      loanId: interestLog.loanId,
      calculationDate: interestLog.calculationDate.toISOString().split('T')[0],
      principalAmount: interestLog.principalAmount,
      annualInterestRate: loan.interestRate,
      dailyInterestRate: interestLog.dailyInterestRate,
      dailyInterestAmount: interestLog.dailyInterestAmount,
      accumulatedInterest: interestLog.accumulatedInterest,
      daysInYear,
      isLeapYear: isLeap,
    };
  }

  /**
   * Calculate interest for a date range
   * @param loanId - The loan ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Array of daily calculations
   */
  static async calculateInterestRange(
    loanId: string,
    startDate: Date,
    endDate: Date
  ): Promise<InterestCalculationResponse[]> {
    const results: InterestCalculationResponse[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const result = await this.calculateDailyInterest({
        loanId,
        calculationDate: new Date(currentDate),
      });
      results.push(result);

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }

  /**
   * Get accumulated interest for a loan up to a specific date
   * @param loanId - The loan ID
   * @param upToDate - Calculate up to this date
   * @returns Total accumulated interest
   */
  static async getAccumulatedInterest(loanId: string, upToDate: Date): Promise<string> {
    const loan = await Loan.findByPk(loanId);
    if (!loan) {
      throw new AppError('Loan not found', 404);
    }

    // Get the most recent interest log up to the specified date
    const latestLog = await InterestLog.findOne({
      where: {
        loanId,
        calculationDate: {
          [require('sequelize').Op.lte]: upToDate,
        },
      },
      order: [['calculationDate', 'DESC']],
    });

    if (!latestLog) {
      // Calculate from loan start date to upToDate
      await this.calculateInterestRange(loanId, loan.startDate, upToDate);
      
      const newLatestLog = await InterestLog.findOne({
        where: {
          loanId,
          calculationDate: {
            [require('sequelize').Op.lte]: upToDate,
          },
        },
        order: [['calculationDate', 'DESC']],
      });

      return newLatestLog?.accumulatedInterest || '0.00';
    }

    return latestLog.accumulatedInterest;
  }

  /**
   * Create a new loan
   * @param userId - User ID
   * @param principalAmount - Loan amount
   * @param interestRate - Annual interest rate (e.g., 0.275 for 27.5%)
   * @param startDate - Loan start date
   * @returns Created loan
   */
  static async createLoan(
    userId: string,
    principalAmount: number,
    interestRate: number,
    startDate: Date
  ): Promise<Loan> {
    return await Loan.create({
      userId,
      principalAmount: principalAmount.toString(),
      interestRate: interestRate.toString(),
      startDate,
      status: 'ACTIVE',
    });
  }
}
