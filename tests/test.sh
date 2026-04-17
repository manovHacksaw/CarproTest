#!/bin/bash

# Car Rental DApp — Automated Test Script
# Usage: bash tests/test.sh
# Requires: curl, backend running on http://localhost:5000

BASE="http://localhost:5000"
RENTER="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

section() { echo -e "\n${YELLOW}══════════════════════════════════════${NC}"; echo -e "${YELLOW}  $1${NC}"; echo -e "${YELLOW}══════════════════════════════════════${NC}"; }

run() {
  local label=$1
  local method=$2
  local url=$3
  local body=$4
  local expected=$5

  echo -e "\n${CYAN}▶ $label${NC}"

  # Print request
  if [ -n "$body" ]; then
    echo -e "${DIM}  REQUEST : $method $url${NC}"
    echo -e "${DIM}  BODY    : $body${NC}"
  else
    echo -e "${DIM}  REQUEST : $method $url${NC}"
  fi

  # Execute
  if [ "$method" = "GET" ]; then
    R=$(curl -s "$url")
  elif [ -n "$body" ]; then
    R=$(curl -s -X "$method" "$url" -H "Content-Type: application/json" -d "$body")
  else
    R=$(curl -s -X "$method" "$url")
  fi

  echo -e "${DIM}  RESPONSE: $R${NC}"

  # Check
  if echo "$R" | grep -q "$expected"; then
    echo -e "  ${GREEN}✓ PASS${NC}"
    ((PASS++))
  else
    echo -e "  ${RED}✗ FAIL — expected '$expected'${NC}"
    ((FAIL++))
  fi
}

# ── Startup & Health ──────────────────────────────────────────────────────────
section "Startup & Health"

run "T01 Health check — blockchain connected" \
  GET "$BASE/health" "" \
  '"connected":true'

# ── On-chain Payment Handling ─────────────────────────────────────────────────
section "On-chain Payment Handling"

run "T02 Set rental fee to 0.01 ETH" \
  POST "$BASE/api/payments/fee" '{"feeEth":"0.01"}' \
  '"feeEth":"0.01"'

run "T03 Read rental fee from chain" \
  GET "$BASE/api/payments/fee" "" \
  '"eth":"0.01"'

run "T04 Book car (ETH forwarded as msg.value)" \
  POST "$BASE/api/contract/book" \
  "{\"renterAddress\":\"$RENTER\",\"carType\":\"Audi A5 S-Line\",\"pickUpDate\":\"2026-05-01\",\"dropOffDate\":\"2026-05-05\"}" \
  '"success":true'

run "T05 Contract balance is 0.01 ETH after booking" \
  GET "$BASE/api/payments/contract-balance" "" \
  '"eth":"0.01"'

run "T06 reservationPayments[0] = 0.01 ETH on-chain" \
  GET "$BASE/api/payments/chain/0" "" \
  '"eth":"0.01"'

# ── Confirm Reservation ───────────────────────────────────────────────────────
section "Reservation Confirmation"

run "T07 Confirm reservation on chain" \
  POST "$BASE/api/contract/confirm/0" "" \
  '"success":true'

run "T08 Reservation confirmed flag = true" \
  GET "$BASE/api/contract/reservation/0" "" \
  '"confirmed":true'

# ── Dispute Resolution ────────────────────────────────────────────────────────
section "Dispute Resolution"

run "T09 Raise dispute on confirmed reservation" \
  POST "$BASE/api/disputes/0/raise" \
  '{"reason":"Car was not in the agreed condition"}' \
  '"Dispute raised"'

run "T10 Dispute state: raised=true, outcome=None" \
  GET "$BASE/api/disputes/0" "" \
  '"raised":true'

run "T11 Owner resolves dispute with refund=true" \
  POST "$BASE/api/disputes/0/resolve" \
  '{"refund":true}' \
  '"outcome":"Refunded"'

run "T12 Dispute state: raised=false, outcome=Refunded" \
  GET "$BASE/api/disputes/0" "" \
  '"raised":false'

# ── Owner Withdrawal ──────────────────────────────────────────────────────────
section "Owner Withdrawal"

run "T13 Owner withdraws accumulated funds" \
  POST "$BASE/api/payments/withdraw" "" \
  '"success":true'

run "T14 Contract balance is 0 after withdrawal" \
  GET "$BASE/api/payments/contract-balance" "" \
  '"eth":"0.0"'

# ── Regression ────────────────────────────────────────────────────────────────
section "Regression Tests"

run "R01 /health still works" \
  GET "$BASE/health" "" \
  '"connected":true'

run "R02 /api/reservations still works" \
  GET "$BASE/api/reservations" "" \
  '"success":true'

run "R03 /api/contract/count still works" \
  GET "$BASE/api/contract/count" "" \
  '"success":true'

# ── Error Cases ───────────────────────────────────────────────────────────────
section "Error Cases"

run "E01 Raise dispute on invalid reservationId" \
  POST "$BASE/api/disputes/99/raise" \
  '{"reason":"test"}' \
  '"success":false'

run "E02 Resolve non-existent dispute" \
  POST "$BASE/api/disputes/99/resolve" \
  '{"refund":false}' \
  '"success":false'

run "E03 Withdraw from empty contract" \
  POST "$BASE/api/payments/withdraw" "" \
  '"success":false'

run "E04 Set fee without feeEth body" \
  POST "$BASE/api/payments/fee" '{}' \
  '"success":false'

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "\n${YELLOW}══════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed: $PASS${NC}  |  ${RED}Failed: $FAIL${NC}"
echo -e "${YELLOW}══════════════════════════════════════${NC}"
[ $FAIL -eq 0 ] && echo -e "${GREEN}  All tests passed.${NC}" || echo -e "${RED}  Some tests failed.${NC}"
echo ""
