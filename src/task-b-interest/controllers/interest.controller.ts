import { Request, Response } from "express";
import { InterestCalculatorService } from "../services/interest-calculator.service";
import { AppError } from "../../utils/error-handler";
import { sendSuccess, responses } from "../../utils/response-handler";

/**
 * InterestController
 * Handles HTTP requests for interest calculation operations
 */
export class InterestController {
  /**
   * Calculate daily interest for a loan
   * POST /api/calculate-interest
   */
  static async calculateInterest(req: Request, res: Response): Promise<void> {
    const { loanId, calculationDate } = req.body;

    if (!loanId || !calculationDate) {
      throw new AppError(
        "Missing required fields: loanId, calculationDate",
        400,
      );
    }

    const date = new Date(calculationDate);
    if (isNaN(date.getTime())) {
      throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
    }

    const result = await InterestCalculatorService.calculateDailyInterest({
      loanId,
      calculationDate: date,
    });

    sendSuccess(res, result);
  }

  /**
   * Calculate interest for a date range
   * POST /api/calculate-interest/range
   */
  static async calculateInterestRange(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { loanId, startDate, endDate } = req.body;

    if (!loanId || !startDate || !endDate) {
      throw new AppError(
        "Missing required fields: loanId, startDate, endDate",
        400,
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
    }

    if (start > end) {
      throw new AppError("startDate must be before endDate", 400);
    }

    const results = await InterestCalculatorService.calculateInterestRange(
      loanId,
      start,
      end,
    );

    sendSuccess(res, {
      calculations: results,
      count: results.length,
      totalAccumulated:
        results[results.length - 1]?.accumulatedInterest || "0.00",
    });
  }

  /**
   * Get accumulated interest for a loan
   * GET /api/loans/:loanId/accumulated-interest
   */
  static async getAccumulatedInterest(
    req: Request,
    res: Response,
  ): Promise<void> {
    const { loanId } = req.params;
    const { upToDate } = req.query;

    const date = upToDate ? new Date(upToDate as string) : new Date();

    if (isNaN(date.getTime())) {
      throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
    }

    const accumulated = await InterestCalculatorService.getAccumulatedInterest(
      loanId,
      date,
    );

    sendSuccess(res, {
      loanId,
      upToDate: date.toISOString().split("T")[0],
      accumulatedInterest: accumulated,
    });
  }

  /**
   * Create a new loan
   * POST /api/loans
   */
  static async createLoan(req: Request, res: Response): Promise<void> {
    const { userId, principalAmount, interestRate, startDate } = req.body;

    if (!userId || !principalAmount || !interestRate || !startDate) {
      throw new AppError(
        "Missing required fields: userId, principalAmount, interestRate, startDate",
        400,
      );
    }

    const date = new Date(startDate);
    if (isNaN(date.getTime())) {
      throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
    }

    const loan = await InterestCalculatorService.createLoan(
      userId,
      parseFloat(principalAmount),
      parseFloat(interestRate),
      date,
    );

    responses.created(res, {
      loanId: loan.id,
      userId: loan.userId,
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      startDate: loan.startDate,
      status: loan.status,
    });
  }
}
