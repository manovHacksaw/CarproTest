# Car Rental DApp

A decentralized car rental application built on Ethereum using Solidity and Node.js/Express. Users can book cars, pay rental fees on-chain, and raise disputes — all managed through a smart contract backend.

## Features

- On-chain reservation management (book, confirm, cancel)
- On-chain payment handling — rental fee enforced by contract, ETH held in contract, owner withdrawal
- Dispute resolution — renters raise disputes on confirmed bookings, owner resolves with permanent on-chain outcome
- Node.js/Express backend auto-compiles and deploys the contract on startup
- REST API over the smart contract with real-time blockchain event listeners

---

## Smart Contract

**`contracts/CarRental.sol`**

| Function | Access | Description |
|---|---|---|
| `bookCar(...)` | `onlyBackend` | Payable — requires `msg.value >= rentalFee` |
| `confirmReservation(id)` | `onlyBackend` | Sets confirmed flag |
| `cancelReservation(id)` | `onlyBackend` | Deletes reservation slot |
| `raiseDispute(id, reason)` | `onlyBackend` | Requires reservation confirmed, no existing dispute |
| `resolveDispute(id, refund)` | `onlyOwner` | Sets outcome to Refunded or Rejected |
| `withdraw()` | `onlyOwner` | Transfers full contract balance to owner |
| `setRentalFee(fee)` | `onlyOwner` | Updates the required booking fee in wei |

---

## Local Setup

### Prerequisites

- [Node.js](https://nodejs.org/) and npm
- Git

### 1. Install dependencies

```bash
# Root (Hardhat + React)
npm install

# Backend
cd backend && npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Set `PRIVATE_KEY` in `backend/.env` to one of the accounts printed by the Hardhat node. The default already contains Hardhat account #0:

```
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 3. Start Hardhat local node (Terminal 1)

```bash
node node_modules/hardhat/internal/cli/cli.js node
```

Leave this running. You will see 20 funded test accounts printed.

### 4. Start the backend (Terminal 2)

```bash
node backend/server.js
```

The server will auto-compile and deploy the contract. Confirm with:

```bash
curl http://localhost:5000/health
```

Expected: `"blockchain": { "connected": true }`

---

## API Overview

### Payment Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/payments/fee` | Current rental fee from chain |
| `POST` | `/api/payments/fee` | Set rental fee — body: `{ feeEth }` |
| `GET` | `/api/payments/contract-balance` | ETH currently held in contract |
| `GET` | `/api/payments/chain/:reservationId` | ETH paid for a specific booking |
| `POST` | `/api/payments/withdraw` | Owner withdraws all accumulated funds |

### Dispute Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/disputes/:reservationId/raise` | Raise a dispute — body: `{ reason }` |
| `POST` | `/api/disputes/:reservationId/resolve` | Resolve a dispute — body: `{ refund: bool }` |
| `GET` | `/api/disputes/:reservationId` | Get dispute state from chain |

### Existing Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | Server and blockchain status |
| `GET/POST` | `/api/reservations` | Off-chain reservation management |
| `POST` | `/api/contract/book` | Direct on-chain booking |
| `POST` | `/api/contract/confirm/:id` | Confirm reservation on chain |
| `POST` | `/api/contract/cancel/:id` | Cancel reservation on chain |
| `GET` | `/api/contract/reservation/:id` | Read reservation from chain |

---

## Testing

See **[tests/TESTING_GUIDE.md](tests/TESTING_GUIDE.md)** for the full test guide including all test cases, expected responses, and error case documentation.

### Run automated tests

**Linux / macOS / Git Bash:**
```bash
bash tests/test.sh
```

**Windows PowerShell:**
```powershell
.\tests\test.ps1
```

### Quick smoke test

```bash
# 1. Health
curl http://localhost:5000/health

# 2. Set fee
curl -X POST http://localhost:5000/api/payments/fee \
  -H "Content-Type: application/json" -d '{"feeEth":"0.01"}'

# 3. Book
curl -X POST http://localhost:5000/api/contract/book \
  -H "Content-Type: application/json" \
  -d '{"renterAddress":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8","carType":"Audi A5 S-Line","pickUpDate":"2026-05-01","dropOffDate":"2026-05-05"}'

# 4. Check balance
curl http://localhost:5000/api/payments/contract-balance
```

---

## Project Structure

```
CarproTest/
├── contracts/
│   └── CarRental.sol          # Solidity smart contract
├── backend/
│   ├── server.js              # Express app + startup bootstrap
│   ├── services/
│   │   ├── blockchainService.js       # Chain interactions + event listeners
│   │   ├── contractInteractionService.js
│   │   ├── disputeService.js          # Dispute logic
│   │   └── paymentService.js          # Payment logic
│   ├── controllers/
│   │   ├── disputeController.js
│   │   └── paymentController.js
│   └── routes/
│       ├── disputes.js
│       └── payments.js
├── tests/
│   ├── TESTING_GUIDE.md       # Full test documentation
│   ├── test.sh                # Bash test script
│   └── test.ps1               # PowerShell test script
└── TEST_RESULTS.md            # Recorded test run results
```
