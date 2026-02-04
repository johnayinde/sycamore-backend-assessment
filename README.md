# Sycamore Backend Engineer Assessment

A production-ready backend implementation demonstrating wallet transfers with idempotency and precise interest calculations.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Task A: Idempotent Wallet](#task-a-idempotent-wallet)
- [Task B: Interest Accumulator](#task-b-interest-accumulator)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Architectural Decisions](#architectural-decisions)

## Overview

This project implements two critical fintech features:

1. **Task A**: An idempotent wallet transfer system that prevents double-spending and handles race conditions
2. **Task B**: A precise interest calculator that handles leap years and avoids floating-point errors

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **ORM**: Sequelize
- **Caching**: Redis 6+
- **Testing**: Jest
- **Containerization**: Docker & Docker Compose
- **Precision Math**: Decimal.js

## Prerequisites

- Node.js v18 or higher
- PostgreSQL 14 or higher
- Redis 6 or higher
- Docker & Docker Compose (optional but recommended)

## Quick Start

### Option 1: Using Docker

```bash
# Clone the repository
git clone https://github.com/johnayinde/sycamore-backend-assessment.git
cd sycamore-backend-assessment

# Start all services with Docker Compose
docker-compose up --build

# The API will be available at http://localhost:3000
```

### Option 2: Local Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Start PostgreSQL
# (Ensure PostgreSQL is running on localhost:5432)

# Start Redis
redis-server

# Run database migrations
npm run migrate

# Start the development server
npm run dev

# The API will be available at http://localhost:3000
```

## Task A: Idempotent Wallet

### Features

- **Race Condition Prevention**: Uses pessimistic locking with `SERIALIZABLE` isolation level
- **Idempotency**: Prevents double-spending from client double-taps
- **Transaction Log**: Creates `PENDING` log entry before processing
- **Atomic Operations**: All-or-nothing database transactions
- **Audit Trail**: Complete transaction history

### Key Implementation Details

**Preventing Double-Spending:**

```typescript
//  Create PENDING log entry BEFORE transfer (acts as distributed lock)
await IdempotencyService.createPendingLog(idempotencyKey, request);

//  Execute transfer in SERIALIZABLE transaction
await sequelize.transaction({ isolationLevel: SERIALIZABLE }, async (t) => {
  // Lock wallets with pessimistic locking
  const fromWallet = await Wallet.findOne({
    where: { userId: fromUserId },
    lock: t.LOCK.UPDATE,
    transaction: t,
  });

  // Perform transfer here...
});

//  Mark log as COMPLETED
await IdempotencyService.markAsCompleted(idempotencyKey, transactionId, result);
```

**Idempotency Key Handling:**

- Same idempotency key returns cached result if already completed
- Rejects concurrent requests with same key (409 Conflict)
- Allows retry on failed transactions

### API Endpoints

```bash
# Create a wallet
POST /api/wallets
{
  "userId": "user123",
  "initialBalance": 1000
}

# Transfer funds (with idempotency)
POST /api/transfer
{
  "fromUserId": "user123",
  "toUserId": "user456",
  "amount": 200,
  "description": "Payment for services",
  "idempotencyKey": "unique-key-12345"
}

# Get wallet details
GET /api/wallets/:userId

# Get transaction history
GET /api/wallets/:userId/history
```

## Task B: Interest Accumulator

### Features

- **Precise Calculations**: Uses Decimal.js to avoid floating-point errors
- **Leap Year Support**: Correctly handles 365 vs 366 days
- **Daily Compounding**: Tracks interest accumulation day-by-day
- **Audit Log**: Stores all calculations with full precision
- **Idempotent**: Same date calculation returns cached result

### Key Implementation Details

**Precise Math with Decimal.js:**

```typescript
// Configure precision to 20 decimal places
Decimal.set({ precision: 20 });

// Calculate daily interest rate
const dailyInterestRate = annualRateDecimal.dividedBy(daysInYear);

// Calculate daily interest (no floating-point errors!)
const dailyInterestAmount = principalDecimal.times(dailyInterestRate);
```

**Leap Year Handling:**

```typescript
// Correct leap year logic
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// Use appropriate days in year
const daysInYear = isLeapYear(year) ? 366 : 365;
```

**Interest Formula:**

```
Daily Interest Rate = Annual Rate / Days in Year
Daily Interest Amount = Principal × Daily Interest Rate
Accumulated Interest = Sum of all daily interest amounts
```

**Example Calculation (27.5% APR, $10,000 principal):**

- **Regular Year (365 days)**:
  - Daily Rate = 0.275 / 365 = 0.00075342
  - Daily Interest = 10000 × 0.00075342 = $7.53
- **Leap Year (366 days)**:
  - Daily Rate = 0.275 / 366 = 0.00075137
  - Daily Interest = 10000 × 0.00075137 = $7.51

### API Endpoints

```bash
# Create a loan
POST /api/loans
{
  "userId": "user123",
  "principalAmount": 10000,
  "interestRate": 0.275,
  "startDate": "2024-01-01"
}

# Calculate interest for a specific date
POST /api/calculate-interest
{
  "loanId": "loan-id",
  "calculationDate": "2024-06-15"
}

# Calculate interest for a date range
POST /api/calculate-interest/range
{
  "loanId": "loan-id",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}

# Get accumulated interest
GET /api/loans/:loanId/accumulated-interest?upToDate=2024-06-15
```

## Testing

### Run Tests Locally

If you're running the app locally without Docker:

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm test -- --coverage
```

### Run Tests in Docker

If you're using Docker, you have several options:

**Option 1: Run tests in a new container**

```bash
# Run tests in an isolated container
docker-compose run --rm app npm test

# Run tests with coverage
docker-compose run --rm app npm test -- --coverage

# Run tests in watch mode
docker-compose run --rm app npm run test:watch
```

**Option 2: Run tests in the running app container**

```bash
# First, ensure containers are running
docker-compose up -d

# Execute tests in the running container
docker exec sycamore_app npm test

# With coverage
docker exec sycamore_app npm test -- --coverage
```

**Option 3: Interactive shell in container**

```bash
# Start an interactive shell in the app container
docker-compose exec app sh

# Inside the container, run tests
npm test
npm run test:watch

# Exit when done
exit
```

**Note**: Tests require the database and Redis to be running. The `docker-compose run` command automatically starts dependent services.

### Test Coverage

The test suite includes:

**Task A Tests:**

- Wallet creation and validation
- Successful transfers
- Insufficient balance handling
- Idempotency key validation
- Double-tap prevention
- Concurrent request handling
- Race condition prevention
- Transaction history

**Task B Tests:**

- Leap year detection (2000, 2024, 1900, 2100)
- Daily interest calculation precision
- Leap year vs regular year calculations
- Floating-point error prevention
- Very small and large amounts
- Interest accumulation
- Year transition handling
- Idempotent calculations
- Edge cases

## API Documentation

### Health Check

```bash
GET /health

Response:
{
  "status": "success",
  "message": "Sycamore Backend Assessment API is running",
  "timestamp": "2024-02-04T12:00:00.000Z"
}
```

### Error Responses

All endpoints return consistent error responses:

```json
{
  "status": "error",
  "message": "Error description"
}
```

Common status codes:

- `400`: Bad Request (validation errors)
- `404`: Not Found (resource doesn't exist)
- `409`: Conflict (duplicate/concurrent operation)
- `500`: Internal Server Error

## Architectural Decisions

### 1. Race Condition Prevention

**Approach**: Pessimistic locking with SERIALIZABLE isolation

**Why?**

- Prevents concurrent modifications to the same wallet
- Ensures balance never goes negative
- SERIALIZABLE isolation prevents phantom reads
- Database-level locking is more reliable than application-level locks

**Alternatives Considered:**

- Optimistic locking: Would require retry logic, more complex
- Redis distributed locks: Adds dependency and complexity
- Row-level versioning: Good but SERIALIZABLE is simpler for this use case

### 2. Idempotency Implementation

**Approach**: Transaction log with PENDING status created before processing

**Why?**

- Acts as a distributed lock at the database level
- Provides audit trail for debugging
- Allows retry on failure while preventing duplicates
- Stores both request and response for complete history

**Key Design:**

```
1. Check if idempotency key exists
2. If COMPLETED → return cached response
3. If PENDING → reject (concurrent request)
4. If doesn't exist → create PENDING log
5. Process transaction
6. Mark as COMPLETED/FAILED
```

### 3. Precise Decimal Math

**Approach**: Decimal.js library with 20 decimal precision

**Why?**

- JavaScript's `Number` type uses floating-point (0.1 + 0.2 ≠ 0.3)
- Financial calculations require exact precision
- Decimal.js handles arbitrary precision arithmetic
- Store as string in database to preserve precision

**Example of the problem:**

```javascript
// JavaScript floating-point **error**
0.1 + 0.2 = 0.30000000000000004

// With Decimal.js
new Decimal('0.1').plus('0.2').toString() = '0.3'
```

### 4. Database Schema Design

**Wallets Table:**

- `balance` as DECIMAL(15, 2) with CHECK constraint (>= 0)
- Unique index on userId for fast lookups
- Prevents negative balances at database level

**Transactions Table:**

- Stores both source and destination wallet IDs
- Status enum (PENDING, COMPLETED, FAILED)
- Unique reference for tracking
- Indexes on wallet IDs and status for fast queries

**Transaction Logs Table:**

- Unique constraint on idempotencyKey
- Stores full request/response payloads (JSONB)
- Created BEFORE transaction starts (critical!)

**Interest Logs Table:**

- Composite unique index on (loanId, calculationDate)
- Stores calculated values with full precision
- Immutable (no updates after creation)

### 5. Error Handling Strategy

**Approach**: Custom AppError class with global error handler

**Why?**

- Consistent error responses across all endpoints
- Separates operational errors from programmer errors
- Allows proper HTTP status codes
- Maintains stack traces for debugging

### 6. Docker Setup

**Approach**: Multi-container setup with health checks

**Why?**

- Ensures database is ready before app starts
- Reproducible environment for testing/deployment
- Automatic migrations on startup
- Easy to run anywhere

### 7. Testing Strategy

**Approach**: Integration tests with real database

**Why?**

- Tests actual database transactions and locking
- Catches race conditions that unit tests might miss
- Tests the full flow including ORM behavior
- More confidence in production behavior

## Code Quality Standards

This codebase follows:

- **TypeScript strict mode**: Catches errors at compile time
- **Descriptive variable names**: Self-documenting code
- **Comprehensive comments**: Explains the "why", not just "what"
- **Error handling**: All errors are caught and handled properly
- **DRY principle**: No code duplication
- **Single responsibility**: Each function/class does one thing well
- **Type safety**: Explicit interfaces for all data structures
- **Test coverage**: Critical paths are thoroughly tested

## Troubleshooting

### Docker Issues

**Tests fail with "Cannot connect to database"**

```bash
# Ensure all services are running
docker-compose ps

# If services aren't healthy, restart them
docker-compose restart

# Check logs for errors
docker-compose logs postgres
docker-compose logs redis
```

**Need to rebuild after code changes**

```bash
# Rebuild the app container
docker-compose build app

# Or rebuild and restart everything
docker-compose up --build
```

**Clear all data and start fresh**

```bash
# Stop and remove containers, volumes
docker-compose down -v

# Start fresh
docker-compose up --build
```

**View logs for debugging**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f postgres
```

### Local Setup Issues

**Port already in use**

```bash
# Check what's using the port
lsof -i :3000
lsof -i :5432
lsof -i :6379

# Kill the process or change ports in .env
```

**Database connection fails**

```bash
# Verify PostgreSQL is running
pg_isready -h localhost -p 5432

# Check credentials in .env match your PostgreSQL setup
```

**Redis connection fails**

```bash
# Verify Redis is running
redis-cli ping

# Should respond with "PONG"
```

## Environment Variables

```env
# Application
NODE_ENV=development
PORT=3000

# PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_NAME=sycamore_assessment
DB_USER=postgres
DB_PASSWORD=postgres123

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
```
