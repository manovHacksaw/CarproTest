# Car Rental DApp — Implementation Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Task 1 — Smart Contract Extensions](#task-1--smart-contract-extensions)
3. [Task 2 — API Development](#task-2--api-development)
4. [Task 3 — Booking Flow](#task-3--booking-flow)
5. [Task 4 — Reservation Confirmation](#task-4--reservation-confirmation)
6. [Task 5 — Execution and Verification](#task-5--execution-and-verification)
7. [Additional Feature: ETH Refund on Dispute Resolution](#additional-feature-eth-refund-on-dispute-resolution)
8. [Additional Feature: Cancellation Refund Policy](#additional-feature-cancellation-refund-policy)

---

## Project Overview

A full-stack Car Rental DApp using:
- **Smart Contract:** Solidity (`contracts/CarRental.sol`)
- **Local Blockchain:** Hardhat node (chainId 31337)
- **Backend:** Node.js + Express (`backend/`)
- **Chain Interaction:** ethers.js v5
- **Local Database:** File-based JSON store (`backend/data/db.json`)

The backend compiles and deploys the smart contract on every startup, making it self-contained for development.

---

## Task 1 — Smart Contract Extensions

**File:** `contracts/CarRental.sol`

### 1a. `getRenterReservations(address _renter)`

```solidity
function getRenterReservations(address _renter) external view returns (uint256[] memory) {
    uint256[] memory temp = new uint256[](reservationCount);
    uint256 count = 0;
    for (uint256 i = 0; i < reservationCount; i++) {
        if (reservations[i].renter == _renter) {
            temp[count] = i;
            count++;
        }
    }
    uint256[] memory result = new uint256[](count);
    for (uint256 i = 0; i < count; i++) {
        result[i] = temp[i];
    }
    return result;
}
```

**Why two loops / two arrays?**  
Solidity memory arrays require a fixed size at declaration. The first loop uses a worst-case-sized `temp` array to collect matching IDs and track a `count`. The second loop copies into a correctly-sized `result` array. This is the standard Solidity pattern for returning a dynamically filtered subset from storage.

**`view` modifier** means the function only reads state, never writes — zero gas cost when called off-chain via ethers.js.

---

### 1b. `getTotalRentalDays()`

```solidity
function getTotalRentalDays() external view returns (uint256) {
    uint256 total = 0;
    for (uint256 i = 0; i < reservationCount; i++) {
        if (reservations[i].renter != address(0)) {
            total += (reservations[i].dropOffDate - reservations[i].pickUpDate) / 1 days;
        }
    }
    return total;
}
```

**Key decisions:**

| Decision | Reason |
|---|---|
| `renter != address(0)` check | `delete reservations[i]` resets all fields to zero; `address(0)` is the cancelled-slot sentinel |
| `/ 1 days` | Solidity built-in constant (`86400`). Timestamps are Unix seconds, so dividing the difference gives whole days |
| Integer division truncates | A 6.5-day rental counts as 6 days — acceptable for cumulative stats |
| `uint256` return | Cannot be negative; dropOff is always after pickUp by backend validation |

**Production note:** This is O(n) over all reservations. At scale, maintain a running `totalDays` state variable updated on each `bookCar` and `cancelReservation` call for O(1) reads.

---

### 1c. Modified `CarBooked` Event

**Before:**
```solidity
event CarBooked(address indexed renter, string carType, uint256 pickUpDate, uint256 dropOffDate);
```

**After:**
```solidity
event CarBooked(uint256 indexed reservationId, address indexed renter, string carType, uint256 pickUpDate, uint256 dropOffDate);
```

**Why `indexed`?**  
Ethereum stores indexed fields in the transaction log's **topic fields**, not the data payload. This enables filtering events by `reservationId` directly at the node level — e.g., "give me all CarBooked events where reservationId = 5" — without scanning every event ever emitted.

**Solidity allows up to 3 `indexed` fields per event.** Indexed fields cost slightly more gas but are essential for anything that needs to be looked up later. Addresses and IDs are the classic choices.

**Emit updated to match:**
```solidity
// reservationId captured before push so it equals the array index
uint256 reservationId = reservationCount;
reservations.push(...);
reservationCount++;
emit CarBooked(reservationId, _renter, _carType, _pickUpDate, _dropOffDate);
```

---

## Task 2 — API Development

**File:** `backend/routes/blockchain.js`  
**Service:** `backend/services/blockchainService.js`

### `GET /api/blockchain/renter/:address/reservations`

```js
router.get("/renter/:address/reservations", async (req, res) => {
  const { address } = req.params;
  if (!isValidEthAddress(address)) return errorResponse(res, "Invalid Ethereum address", 422);
  try {
    const ids = await blockchainService.getRenterReservationsFromChain(address);
    return successResponse(res, { address, reservationIds: ids, count: ids.length });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});
```

**blockchainService layer:**
```js
async function getRenterReservationsFromChain(renterAddress) {
  const ids = await getContract().getRenterReservations(renterAddress);
  return ids.map((id) => id.toNumber());
}
```

The contract returns `uint256[]` which ethers.js deserialises as an array of `BigNumber`. The `.map(id => id.toNumber())` converts each to a plain JS number before returning.

**Sample response:**
```json
{
  "success": true,
  "data": {
    "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "reservationIds": [0, 2, 5],
    "count": 3
  }
}
```

---

### `GET /api/blockchain/stats/total-days`

```js
router.get("/stats/total-days", async (req, res) => {
  try {
    const totalDays = await blockchainService.getTotalRentalDaysFromChain();
    return successResponse(res, { totalRentalDays: totalDays });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});
```

**blockchainService layer:**
```js
async function getTotalRentalDaysFromChain() {
  const days = await getContract().getTotalRentalDays();
  return days.toNumber();
}
```

**Sample response:**
```json
{
  "success": true,
  "data": { "totalRentalDays": 21 }
}
```

---

## Task 3 — Booking Flow

**File:** `backend/services/reservationService.js`

### What changed in `createReservation`

After saving the reservation locally, the backend now calls `bookCarOnChain` and stores the result back into the same DB record.

```js
// 1. Save locally first (immediate, no chain dependency)
db.saveReservation(reservation);

// 2. Write to blockchain
try {
  const { receipt, chainReservationId } = await blockchainService.bookCarOnChain(
    renterAddress, carName, pickUpDate, dropOffDate
  );
  // 3. Update local record with chain data
  const withChain = {
    ...reservation,
    chainReservationId,
    txHash: receipt.transactionHash,
    updatedAt: new Date().toISOString(),
  };
  db.saveReservation(withChain);
  return withChain;
} catch (err) {
  // Chain failed: return local record, chainReservationId stays null
  logger.error("On-chain booking failed", { id: reservation.id, error: err.message });
  return reservation;
}
```

### Extracting `chainReservationId` from the receipt

**File:** `backend/services/blockchainService.js`

```js
async function bookCarOnChain(renterAddress, carType, pickUpDate, dropOffDate) {
  const pickTs = Math.floor(new Date(pickUpDate).getTime() / 1000);
  const dropTs = Math.floor(new Date(dropOffDate).getTime() / 1000);
  const fee = await getContract().rentalFee();
  const tx = await getContract().bookCar(renterAddress, carType, pickTs, dropTs, { value: fee });
  const receipt = await tx.wait();

  // Parse the CarBooked event from the receipt
  const event = receipt.events?.find((e) => e.event === "CarBooked");
  const chainReservationId = event?.args?.reservationId?.toNumber() ?? null;

  return { receipt, chainReservationId };
}
```

**Why attach `{ value: fee }`?**  
The contract's `bookCar` is `payable` and requires `msg.value >= rentalFee`. The backend reads the current fee from chain just before calling and forwards it as ETH. This is the custodial model — the backend holds funds on the renter's behalf.

**Why read the fee fresh each call?**  
The owner can update `rentalFee` at any time via `setRentalFee`. Reading it on every booking ensures the backend never sends a stale amount that would fail the `require`.

---

## Task 4 — Reservation Confirmation

**File:** `backend/services/reservationService.js`  
**Route:** `PATCH /api/reservations/:id/confirm`

### `confirmReservation(reservationId)`

```js
async function confirmReservation(reservationId) {
  const reservation = db.getReservationById(reservationId);
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status === "cancelled") throw new Error("Cannot confirm a cancelled reservation");

  // Guard: can only confirm if the booking reached the chain
  if (reservation.chainReservationId === null || reservation.chainReservationId === undefined)
    throw new Error("No on-chain reservation ID — booking was never written to the blockchain");

  // Call chain using the stored integer ID (not the local UUID)
  await blockchainService.confirmReservationOnChain(reservation.chainReservationId);

  const updated = { ...reservation, status: "confirmed", updatedAt: new Date().toISOString() };
  db.saveReservation(updated);
  return updated;
}
```

### Why `chainReservationId` instead of `txHash`

The smart contract's `confirmReservation(uint256 _reservationId)` takes an integer index into the `reservations[]` array. The `txHash` is a receipt identifier — it proves the booking transaction happened but is not what the contract uses to look up a reservation. Using `chainReservationId` (extracted from the `CarBooked` event at booking time) is the correct, direct reference.

### Route change

```js
// Before: required txHash from client body, used validateConfirm middleware
router.patch("/:id/confirm", validateConfirm, async (req, res) => {
  const updated = await reservationService.confirmReservation(req.params.id, req.body.txHash);
  ...
});

// After: no client input needed — chainReservationId comes from DB
router.patch("/:id/confirm", async (req, res) => {
  const updated = await reservationService.confirmReservation(req.params.id);
  ...
});
```

---

## Task 5 — Execution and Verification

### Starting the servers

```bash
# Terminal 1 — local Hardhat blockchain
npx hardhat node

# Terminal 2 — backend (auto-compiles and deploys contract on startup)
node backend/server.js
```

### Verification sequence

#### 1. Health check
```bash
curl http://localhost:5000/health
```
Expected: `"blockchain": { "connected": true }`

#### 2. Create a reservation
```bash
curl -X POST http://localhost:5000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "renterAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "carName": "BMW 530",
    "pickUpDate": "2026-05-01",
    "dropOffDate": "2026-05-08",
    "pickUpLocation": "Los Angeles",
    "dropOffLocation": "Los Angeles",
    "personalInfo": { "name": "Test User", "email": "test@example.com", "phone": "555-0100" }
  }'
```
Expected: `chainReservationId` is not null, `txHash` is set

#### 3. Confirm the reservation
```bash
curl -X PATCH http://localhost:5000/api/reservations/<id>/confirm
```
Expected: `"status": "confirmed"`

#### 4. Verify confirmation on-chain
```bash
curl http://localhost:5000/api/blockchain/reservations/<chainReservationId>
```
Expected: `"confirmed": true`

#### 5. Renter reservation lookup
```bash
curl http://localhost:5000/api/blockchain/renter/0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266/reservations
```
Expected: `"reservationIds": [0]`

#### 6. Total rental days
```bash
curl http://localhost:5000/api/blockchain/stats/total-days
```
Expected: `"totalRentalDays": 7` (7 days for May 1–8)

---

## Additional Feature: ETH Refund on Dispute Resolution

**File:** `contracts/CarRental.sol` — `resolveDispute`

### The problem

The original implementation set `outcome = Refunded` as an on-chain flag but never transferred any ETH. The renter received a label, not money.

### The fix

```solidity
function resolveDispute(uint256 _reservationId, bool _refund) external onlyOwner {
    require(disputes[_reservationId].raised, "No active dispute");

    // Capture values before state changes
    address renter = disputes[_reservationId].renter;
    uint256 amount = reservationPayments[_reservationId];

    // EFFECTS — all state written before any external call
    disputes[_reservationId].raised = false;
    disputes[_reservationId].outcome = _refund ? DisputeOutcome.Refunded : DisputeOutcome.Rejected;
    if (_refund) {
        require(amount > 0, "No payment on record to refund");
        reservationPayments[_reservationId] = 0;   // zero out BEFORE transfer
    }
    emit DisputeResolved(_reservationId, msg.sender, _refund);

    // INTERACTIONS — ETH transfer is always last
    if (_refund) {
        (bool ok, ) = payable(renter).call{value: amount}("");
        require(ok, "Refund transfer failed");
        emit RefundIssued(_reservationId, renter, amount, "Dispute resolved in renter's favour");
    }
}
```

### Checks-Effects-Interactions (CEI) pattern

This is a critical security pattern in Solidity. The threat is **reentrancy**:

1. Owner calls `resolveDispute(0, true)`
2. Contract calls `renter.call{value: amount}("")`
3. Renter is a malicious contract — its `receive()` immediately calls `resolveDispute(0, true)` again
4. If `reservationPayments[0]` was NOT zeroed out yet, the second call passes `require(amount > 0)` and drains the balance a second time

**CEI prevents this:** `reservationPayments[_reservationId] = 0` runs *before* the `.call`. The reentrant call hits `require(amount > 0)` where `amount` is now `0`, and reverts. The attack fails.

```
CHECKS      → require(disputes[id].raised)
EFFECTS     → set raised=false, outcome, zero out payment  ← reentrant call hits 0 here
INTERACTIONS → payable(renter).call{value: amount}         ← external call last
```

### Why `.call` not `.transfer`

`.transfer()` hard-limits forwarded gas to 2300 — enough for a simple EOA receive, but not for a contract recipient with any logic in `receive()`. Since the renter could be a smart contract wallet, `.call` is used to forward all available gas. The bool return is explicitly checked with `require(ok)`.

---

## Additional Feature: Cancellation Refund Policy

**File:** `contracts/CarRental.sol` — `cancelReservation`

### The problem

The original `cancelReservation` called `delete reservations[i]` and emitted an event. The ETH from `reservationPayments[i]` was never returned — it stayed locked in the contract forever with no way to distinguish "legitimately held fee" from "forgotten money".

### The fix

```solidity
function cancelReservation(uint256 _reservationId) external onlyBackend {
    require(_reservationId < reservationCount, "Invalid reservation ID");

    // Capture BEFORE delete zeroes the struct
    address renter = reservations[_reservationId].renter;
    uint256 pickUpDate = reservations[_reservationId].pickUpDate;
    uint256 payment = reservationPayments[_reservationId];

    // EFFECTS
    delete reservations[_reservationId];
    reservationPayments[_reservationId] = 0;
    emit ReservationCanceled(_reservationId);

    // INTERACTIONS — refund tier based on timing
    if (payment > 0 && renter != address(0)) {
        uint256 refundAmount = 0;
        string memory reason;

        if (block.timestamp < pickUpDate) {
            if (pickUpDate - block.timestamp > 48 hours) {
                refundAmount = payment;                      // full refund
                reason = "Full refund: cancelled >48h before pickup";
            } else {
                refundAmount = payment / 2;                  // 50% refund
                reason = "Partial refund: cancelled within 48h of pickup";
            }
        }
        // Past pickup date: no refund — ETH stays in contract as penalty

        if (refundAmount > 0) {
            (bool ok, ) = payable(renter).call{value: refundAmount}("");
            require(ok, "Refund transfer failed");
            emit RefundIssued(_reservationId, renter, refundAmount, reason);
        }
    }
}
```

### Refund tiers

| Cancellation timing | Refund | Rationale |
|---|---|---|
| More than 48 hours before pickup | 100% | Sufficient notice; car can be re-listed |
| Within 48 hours of pickup | 50% | Late cancellation; lost opportunity cost |
| After pickup date has passed | 0% | No-show penalty; full fee stays in contract |

### Design decisions

**Capture before `delete`:**  
`delete reservations[_reservationId]` resets every field in the struct to its zero value — `renter` becomes `address(0)`, `pickUpDate` becomes `0`. Variables must be read before the delete or the data is lost.

**`48 hours` is a Solidity built-in:**  
Same family as `1 days` (86400 seconds). `48 hours` compiles to `172800`. Readable and self-documenting.

**`block.timestamp` accuracy:**  
Validators can nudge `block.timestamp` by roughly 12–15 seconds. This is negligible for a 48-hour boundary. If this were a seconds-precision cutoff, a more robust approach (e.g., a commit-reveal scheme) would be needed.

**The retained 50%:**  
Stays in the contract and is withdrawable by the owner via `withdraw()`. It compensates the operator for the lost booking window.

**CEI applied here too:**  
`delete` and `reservationPayments[_reservationId] = 0` both run before the `.call`. Any reentrant call would find the reservation deleted and payment zeroed, preventing double-refunds.

### Backend wiring

**File:** `backend/services/reservationService.js`

```js
// Before: only updated local DB, contract never called
async function cancelReservation(reservationId, renterAddress) {
  ...
  db.saveReservation({ ...reservation, status: "cancelled" });
  return updated;
}

// After: calls chain first so refund logic in contract executes
if (reservation.chainReservationId !== null && reservation.chainReservationId !== undefined) {
  await blockchainService.cancelReservationOnChain(reservation.chainReservationId);
}
db.saveReservation({ ...reservation, status: "cancelled" });
```

If the on-chain call fails, the function throws before updating the DB — both states stay consistent.

### RefundIssued event (new)

```solidity
event RefundIssued(
    uint256 indexed reservationId,
    address indexed renter,
    uint256 amount,
    string reason
);
```

Emitted on every successful refund transfer — whether from dispute resolution or cancellation. Makes all ETH movements auditable on-chain. The backend listens for this event and logs it to the local event store.
