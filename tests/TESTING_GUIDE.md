# Testing Guide — Car Rental DApp

## Overview

This guide covers how to test the two features added to the Car Rental DApp:

1. **On-chain Payment Handling** — rental fee enforcement, ETH custody in contract, owner withdrawal
2. **Dispute Resolution** — raising disputes on confirmed bookings, owner resolution with outcome

---

## Prerequisites

### 1. Start the Hardhat local node (Terminal 1)
```bash
node node_modules/hardhat/internal/cli/cli.js node
```
Leave this running. You should see 20 test accounts printed with private keys and the node listening on `http://127.0.0.1:8545`.

### 2. Configure backend environment
```bash
cp backend/.env.example backend/.env
```
Set `PRIVATE_KEY` to one of the accounts printed by the Hardhat node. The default `.env` already contains Hardhat account #0's key:
```
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 3. Install dependencies
```bash
# Root (Hardhat + React)
npm install

# Backend
cd backend && npm install
```

### 4. Start the backend (Terminal 2)
```bash
node backend/server.js
```

The server will auto-compile and deploy the contract. You should see:
```
Contract compiled successfully
Contract deployed { contractAddress: 0x... }
Server running on http://localhost:5000
```

### 5. Verify startup
```bash
curl http://localhost:5000/health
```
Expected: `"blockchain": { "connected": true }`

---

## Running the Tests

### Option A — Automated script (recommended)
```bash
# Linux / macOS / Git Bash
bash tests/test.sh

# Windows PowerShell
.\tests\test.ps1
```

### Option B — Manual curl commands
Follow the step-by-step sections below.

---

## Test Cases

---

### T01 — Health Check
Verifies the server is running and blockchain is connected.

```bash
curl http://localhost:5000/health
```

**Expected:**
```json
{ "status": "ok", "blockchain": { "connected": true } }
```

---

### T02 — Set Rental Fee
Owner sets the on-chain rental fee to 0.01 ETH. This calls `setRentalFee()` on the contract.

```bash
curl -X POST http://localhost:5000/api/payments/fee \
  -H "Content-Type: application/json" \
  -d '{"feeEth":"0.01"}'
```

**Expected:**
```json
{ "success": true, "data": { "txHash": "0x...", "feeEth": "0.01", "feeWei": "10000000000000000" } }
```

---

### T03 — Read Rental Fee from Chain
Reads `rentalFee` storage variable directly from the deployed contract.

```bash
curl http://localhost:5000/api/payments/fee
```

**Expected:**
```json
{ "success": true, "data": { "wei": "10000000000000000", "eth": "0.01" } }
```

---

### T04 — Book a Car (ETH forwarded on-chain)
Backend calls `bookCar()` on the contract and attaches `msg.value = rentalFee`. ETH is now held by the contract.

```bash
curl -X POST http://localhost:5000/api/contract/book \
  -H "Content-Type: application/json" \
  -d '{
    "renterAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "carType": "Audi A5 S-Line",
    "pickUpDate": "2026-05-01",
    "dropOffDate": "2026-05-05"
  }'
```

**Expected:**
```json
{ "success": true, "message": "Booking recorded on chain", "data": { "txHash": "0x..." } }
```

> **Note:** `renterAddress` must be a valid Ethereum address. Use any of the Hardhat test accounts printed at node startup.

---

### T05 — Verify Contract Balance
Contract should now hold 0.01 ETH from the booking.

```bash
curl http://localhost:5000/api/payments/contract-balance
```

**Expected:**
```json
{ "success": true, "data": { "wei": "10000000000000000", "eth": "0.01" } }
```

---

### T06 — Read Per-Reservation Payment
Reads `reservationPayments[0]` from the contract — the exact ETH paid for reservation ID 0.

```bash
curl http://localhost:5000/api/payments/chain/0
```

**Expected:**
```json
{ "success": true, "data": { "reservationId": 0, "wei": "10000000000000000", "eth": "0.01" } }
```

---

### T07 — Confirm Reservation On-chain
Sets `reservations[0].confirmed = true` on the contract. Required before a dispute can be raised.

```bash
curl -X POST http://localhost:5000/api/contract/confirm/0
```

**Expected:**
```json
{ "success": true, "message": "Reservation confirmed on chain" }
```

---

### T08 — Verify Confirmed State
Reads the full reservation struct from chain and confirms `confirmed: true`.

```bash
curl http://localhost:5000/api/contract/reservation/0
```

**Expected:**
```json
{ "success": true, "data": { "renter": "0x7099...", "confirmed": true } }
```

---

### T09 — Raise a Dispute
Renter raises a dispute on reservation 0. Only works on confirmed reservations. Only one dispute allowed per reservation.

```bash
curl -X POST http://localhost:5000/api/disputes/0/raise \
  -H "Content-Type: application/json" \
  -d '{"reason":"Car was not in the agreed condition"}'
```

**Expected:**
```json
{ "success": true, "message": "Dispute raised", "data": { "txHash": "0x...", "reservationId": 0 } }
```

---

### T10 — Read Active Dispute State
Reads the dispute from chain. Should show `raised: true` and `outcome: "None"`.

```bash
curl http://localhost:5000/api/disputes/0
```

**Expected:**
```json
{
  "data": {
    "renter": "0x7099...",
    "reason": "Car was not in the agreed condition",
    "raised": true,
    "outcome": "None"
  }
}
```

---

### T11 — Resolve Dispute (Owner)
Owner resolves the dispute. `refund: true` sets outcome to `Refunded`, `refund: false` sets it to `Rejected`. Outcome is permanent on-chain.

```bash
curl -X POST http://localhost:5000/api/disputes/0/resolve \
  -H "Content-Type: application/json" \
  -d '{"refund":true}'
```

**Expected:**
```json
{ "success": true, "message": "Dispute resolved", "data": { "outcome": "Refunded" } }
```

---

### T12 — Verify Resolved Dispute State
`raised` flips to `false` after resolution. Outcome is permanently stored on-chain.

```bash
curl http://localhost:5000/api/disputes/0
```

**Expected:**
```json
{ "data": { "raised": false, "outcome": "Refunded" } }
```

---

### T13 — Owner Withdraws Funds
Calls `withdraw()` on contract. Transfers full contract balance to owner wallet.

```bash
curl -X POST http://localhost:5000/api/payments/withdraw
```

**Expected:**
```json
{ "success": true, "message": "Funds withdrawn successfully", "data": { "txHash": "0x..." } }
```

---

### T14 — Verify Contract Drained
Contract balance should be zero after withdrawal.

```bash
curl http://localhost:5000/api/payments/contract-balance
```

**Expected:**
```json
{ "data": { "wei": "0", "eth": "0.0" } }
```

---

## Regression Tests

These verify that existing endpoints are unaffected by the new features.

```bash
# Health
curl http://localhost:5000/health

# Reservations list
curl http://localhost:5000/api/reservations

# Contract reservation count
curl http://localhost:5000/api/contract/count
```

All three should return `"success": true`.

---

## Error Cases Worth Testing Manually

| Scenario | Endpoint | Expected Error |
|---|---|---|
| Book with zero fee not set | `POST /api/contract/book` | Works (fee = 0 satisfies `>= 0`) |
| Raise dispute on unconfirmed reservation | `POST /api/disputes/0/raise` | `"Reservation not confirmed"` |
| Raise duplicate dispute | `POST /api/disputes/0/raise` again | `"Dispute already raised"` |
| Resolve non-existent dispute | `POST /api/disputes/99/resolve` | `"No active dispute"` |
| Withdraw with empty contract | `POST /api/payments/withdraw` | `"Nothing to withdraw"` |

---

## API Reference

### Payment Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/payments/fee` | Current rental fee from chain |
| `POST` | `/api/payments/fee` | Set rental fee (owner) — body: `{ feeEth }` |
| `GET` | `/api/payments/contract-balance` | ETH held in contract |
| `GET` | `/api/payments/chain/:reservationId` | ETH paid for a specific booking |
| `POST` | `/api/payments/withdraw` | Owner withdraws all funds |

### Dispute Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/disputes/:reservationId/raise` | Raise dispute — body: `{ reason }` |
| `POST` | `/api/disputes/:reservationId/resolve` | Resolve dispute — body: `{ refund: bool }` |
| `GET` | `/api/disputes/:reservationId` | Get dispute state from chain |
