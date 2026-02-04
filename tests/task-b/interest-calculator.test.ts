import sequelize from '../../src/config/database';
import { InterestCalculatorService } from '../../src/task-b-interest/services/interest-calculator.service';
import Loan from '../../src/task-b-interest/models/loan.model';
import InterestLog from '../../src/task-b-interest/models/interest-log.model';
import Decimal from 'decimal.js';

/**
 * Test Suite for Task B: Interest Accumulator
 * Tests precise decimal calculations and leap year handling
 */
describe('Task B: Interest Accumulator - InterestCalculatorService', () => {
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
    await InterestLog.destroy({ where: {} });
    await Loan.destroy({ where: {} });
  });

  describe('Leap Year Detection', () => {
    it('should correctly identify leap years', () => {
      expect(InterestCalculatorService.isLeapYear(2024)).toBe(true); // Divisible by 4
      expect(InterestCalculatorService.isLeapYear(2020)).toBe(true); // Divisible by 4
      expect(InterestCalculatorService.isLeapYear(2000)).toBe(true); // Divisible by 400
    });

    it('should correctly identify non-leap years', () => {
      expect(InterestCalculatorService.isLeapYear(2023)).toBe(false); // Not divisible by 4
      expect(InterestCalculatorService.isLeapYear(2025)).toBe(false); // Not divisible by 4
      expect(InterestCalculatorService.isLeapYear(1900)).toBe(false); // Divisible by 100 but not 400
      expect(InterestCalculatorService.isLeapYear(2100)).toBe(false); // Divisible by 100 but not 400
    });

    it('should return correct days in year', () => {
      expect(InterestCalculatorService.getDaysInYear(2024)).toBe(366); // Leap year
      expect(InterestCalculatorService.getDaysInYear(2023)).toBe(365); // Regular year
      expect(InterestCalculatorService.getDaysInYear(2000)).toBe(366); // Leap year
      expect(InterestCalculatorService.getDaysInYear(1900)).toBe(365); // Not a leap year
    });
  });

  describe('Loan Creation', () => {
    it('should create a loan with correct attributes', async () => {
      const loan = await InterestCalculatorService.createLoan(
        'user1',
        10000,
        0.275, // 27.5%
        new Date('2024-01-01')
      );

      expect(loan).toBeDefined();
      expect(loan.userId).toBe('user1');
      expect(loan.principalAmount).toBe('10000.00');
      expect(loan.interestRate).toBe('0.2750');
      expect(loan.status).toBe('ACTIVE');
    });
  });

  describe('Daily Interest Calculation - Mathematical Precision', () => {
    let loan: Loan;

    beforeEach(async () => {
      loan = await InterestCalculatorService.createLoan(
        'user1',
        10000,
        0.275, // 27.5% per annum
        new Date('2024-01-01')
      );
    });

    it('should calculate daily interest correctly for regular year', async () => {
      // 2023 is a regular year (365 days)
      const result = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2023-06-15'),
      });

      // Expected calculation:
      // Daily Rate = 0.275 / 365 = 0.00075342
      // Daily Interest = 10000 * 0.00075342 = 7.534247
      
      expect(result.isLeapYear).toBe(false);
      expect(result.daysInYear).toBe(365);
      expect(result.principalAmount).toBe('10000.00');
      
      // Using Decimal.js for precise calculation
      const expectedDailyRate = new Decimal('0.275').dividedBy(365);
      const expectedInterest = new Decimal('10000').times(expectedDailyRate);
      
      expect(result.dailyInterestAmount).toBe(expectedInterest.toFixed(2));
    });

    it('should calculate daily interest correctly for leap year', async () => {
      // 2024 is a leap year (366 days)
      const result = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-06-15'),
      });

      // Expected calculation:
      // Daily Rate = 0.275 / 366 = 0.00075137
      // Daily Interest = 10000 * 0.00075137 = 7.513661
      
      expect(result.isLeapYear).toBe(true);
      expect(result.daysInYear).toBe(366);
      
      const expectedDailyRate = new Decimal('0.275').dividedBy(366);
      const expectedInterest = new Decimal('10000').times(expectedDailyRate);
      
      expect(result.dailyInterestAmount).toBe(expectedInterest.toFixed(2));
    });

    it('should not have floating-point errors', async () => {
      const result = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-01-15'),
      });

      // Verify the result is a valid decimal string, not NaN or undefined
      expect(result.dailyInterestAmount).toMatch(/^\d+\.\d{2}$/);
      
      // Parse and verify it's a valid number
      const amount = parseFloat(result.dailyInterestAmount);
      expect(amount).toBeGreaterThan(0);
      expect(amount).toBeLessThan(100); // Sanity check
      
      // Verify precision - should be exactly 2 decimal places
      const parts = result.dailyInterestAmount.split('.');
      expect(parts[1]).toHaveLength(2);
    });

    it('should calculate correctly for very small amounts', async () => {
      const smallLoan = await InterestCalculatorService.createLoan(
        'user2',
        1, // $1 principal
        0.275,
        new Date('2024-01-01')
      );

      const result = await InterestCalculatorService.calculateDailyInterest({
        loanId: smallLoan.id,
        calculationDate: new Date('2024-06-15'),
      });

      // Should still calculate precisely even for small amounts
      const expectedDailyRate = new Decimal('0.275').dividedBy(366);
      const expectedInterest = new Decimal('1').times(expectedDailyRate);
      
      expect(result.dailyInterestAmount).toBe(expectedInterest.toFixed(2));
    });

    it('should calculate correctly for very large amounts', async () => {
      const largeLoan = await InterestCalculatorService.createLoan(
        'user3',
        1000000, // $1 million
        0.275,
        new Date('2024-01-01')
      );

      const result = await InterestCalculatorService.calculateDailyInterest({
        loanId: largeLoan.id,
        calculationDate: new Date('2024-06-15'),
      });

      const expectedDailyRate = new Decimal('0.275').dividedBy(366);
      const expectedInterest = new Decimal('1000000').times(expectedDailyRate);
      
      expect(result.dailyInterestAmount).toBe(expectedInterest.toFixed(2));
    });
  });

  describe('Interest Accumulation', () => {
    let loan: Loan;

    beforeEach(async () => {
      loan = await InterestCalculatorService.createLoan(
        'user1',
        10000,
        0.275,
        new Date('2024-01-01')
      );
    });

    it('should accumulate interest correctly over multiple days', async () => {
      // Calculate for 3 consecutive days
      const day1 = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-01-01'),
      });

      const day2 = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-01-02'),
      });

      const day3 = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-01-03'),
      });

      // Day 1 accumulated should equal daily interest
      expect(day1.accumulatedInterest).toBe(day1.dailyInterestAmount);

      // Day 2 accumulated should be day1 + day2
      const expectedDay2 = new Decimal(day1.dailyInterestAmount)
        .plus(day2.dailyInterestAmount)
        .toFixed(2);
      expect(day2.accumulatedInterest).toBe(expectedDay2);

      // Day 3 accumulated should be day1 + day2 + day3
      const expectedDay3 = new Decimal(day2.accumulatedInterest)
        .plus(day3.dailyInterestAmount)
        .toFixed(2);
      expect(day3.accumulatedInterest).toBe(expectedDay3);
    });

    it('should handle leap year transition correctly', async () => {
      // Feb 28, 2024 (leap year)
      const feb28 = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-02-28'),
      });

      // Feb 29, 2024 (leap day)
      const feb29 = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-02-29'),
      });

      // Mar 1, 2024
      const mar1 = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-03-01'),
      });

      // All should use 366 days for 2024
      expect(feb28.daysInYear).toBe(366);
      expect(feb29.daysInYear).toBe(366);
      expect(mar1.daysInYear).toBe(366);

      // Interest should accumulate correctly
      expect(parseFloat(mar1.accumulatedInterest)).toBeGreaterThan(
        parseFloat(feb29.accumulatedInterest)
      );
    });
  });

  describe('Interest Range Calculation', () => {
    let loan: Loan;

    beforeEach(async () => {
      loan = await InterestCalculatorService.createLoan(
        'user1',
        10000,
        0.275,
        new Date('2024-01-01')
      );
    });

    it('should calculate interest for a date range', async () => {
      const results = await InterestCalculatorService.calculateInterestRange(
        loan.id,
        new Date('2024-01-01'),
        new Date('2024-01-05')
      );

      expect(results).toHaveLength(5); // 5 days
      
      // Each day should have interest calculated
      results.forEach((result) => {
        expect(parseFloat(result.dailyInterestAmount)).toBeGreaterThan(0);
      });

      // Accumulated interest should increase each day
      for (let i = 1; i < results.length; i++) {
        expect(parseFloat(results[i].accumulatedInterest)).toBeGreaterThan(
          parseFloat(results[i - 1].accumulatedInterest)
        );
      }
    });

    it('should handle year transition in range calculation', async () => {
      const results = await InterestCalculatorService.calculateInterestRange(
        loan.id,
        new Date('2023-12-30'),
        new Date('2024-01-02')
      );

      expect(results).toHaveLength(4);
      
      // Dec 30-31, 2023 should use 365 days
      expect(results[0].daysInYear).toBe(365);
      expect(results[1].daysInYear).toBe(365);
      
      // Jan 1-2, 2024 should use 366 days
      expect(results[2].daysInYear).toBe(366);
      expect(results[3].daysInYear).toBe(366);
    });
  });

  describe('Idempotency - Same Date Calculation', () => {
    let loan: Loan;

    beforeEach(async () => {
      loan = await InterestCalculatorService.createLoan(
        'user1',
        10000,
        0.275,
        new Date('2024-01-01')
      );
    });

    it('should return same result when calculating for same date twice', async () => {
      const result1 = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-01-15'),
      });

      const result2 = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-01-15'),
      });

      expect(result1.dailyInterestAmount).toBe(result2.dailyInterestAmount);
      expect(result1.accumulatedInterest).toBe(result2.accumulatedInterest);
    });
  });

  describe('Edge Cases', () => {
    it('should handle calculation on loan start date', async () => {
      const loan = await InterestCalculatorService.createLoan(
        'user1',
        10000,
        0.275,
        new Date('2024-01-01')
      );

      const result = await InterestCalculatorService.calculateDailyInterest({
        loanId: loan.id,
        calculationDate: new Date('2024-01-01'),
      });

      expect(result.accumulatedInterest).toBe(result.dailyInterestAmount);
    });

    it('should throw error for inactive loan', async () => {
      const loan = await Loan.create({
        userId: 'user1',
        principalAmount: '10000',
        interestRate: '0.275',
        startDate: new Date('2024-01-01'),
        status: 'PAID',
      });

      await expect(
        InterestCalculatorService.calculateDailyInterest({
          loanId: loan.id,
          calculationDate: new Date('2024-01-15'),
        })
      ).rejects.toThrow('Cannot calculate interest for inactive loan');
    });

    it('should throw error for non-existent loan', async () => {
      await expect(
        InterestCalculatorService.calculateDailyInterest({
          loanId: 'non-existent-id',
          calculationDate: new Date('2024-01-15'),
        })
      ).rejects.toThrow('Loan not found');
    });
  });

  describe('Accumulated Interest Retrieval', () => {
    let loan: Loan;

    beforeEach(async () => {
      loan = await InterestCalculatorService.createLoan(
        'user1',
        10000,
        0.275,
        new Date('2024-01-01')
      );
    });

    it('should retrieve accumulated interest up to a date', async () => {
      // Calculate interest for 5 days
      await InterestCalculatorService.calculateInterestRange(
        loan.id,
        new Date('2024-01-01'),
        new Date('2024-01-05')
      );

      const accumulated = await InterestCalculatorService.getAccumulatedInterest(
        loan.id,
        new Date('2024-01-05')
      );

      expect(parseFloat(accumulated)).toBeGreaterThan(0);
    });
  });
});
