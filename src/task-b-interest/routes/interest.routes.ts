import { Router } from "express";
import { InterestController } from "../controllers/interest.controller";
import { asyncHandler } from "../../utils/error-handler";

const router = Router();

/**
 * @route   POST /api/calculate-interest
 * @desc    Calculate daily interest for a specific date
 */
router.post(
  "/calculate-interest",
  asyncHandler(InterestController.calculateInterest),
);

/**
 * @route   POST /api/calculate-interest/range
 * @desc    Calculate interest for a date range
 */
router.post(
  "/calculate-interest/range",
  asyncHandler(InterestController.calculateInterestRange),
);

/**
 * @route   GET /api/loans/:loanId/accumulated-interest
 * @desc    Get accumulated interest for a loan up to a date
 */
router.get(
  "/loans/:loanId/accumulated-interest",
  asyncHandler(InterestController.getAccumulatedInterest),
);

/**
 * @route   POST /api/loans
 * @desc    Create a new loan
 */
router.post("/loans", asyncHandler(InterestController.createLoan));

export default router;
