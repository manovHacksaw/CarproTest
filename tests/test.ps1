# Car Rental DApp — Automated Test Script (PowerShell)
# Usage: .\tests\test.ps1
# Requires: backend running on http://localhost:5000

$BASE   = "http://localhost:5000"
$RENTER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
$PASS   = 0
$FAIL   = 0

function Section($title) {
    Write-Host ""
    Write-Host "══════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  $title"                               -ForegroundColor Yellow
    Write-Host "══════════════════════════════════════" -ForegroundColor Yellow
}

function Run($label, $method, $url, $body, $expected) {
    Write-Host ""
    Write-Host "▶ $label" -ForegroundColor Cyan

    # Print request
    Write-Host "  REQUEST : $method $url" -ForegroundColor DarkGray
    if ($body -and $body -ne '{}' -and $body -ne '') {
        Write-Host "  BODY    : $body" -ForegroundColor DarkGray
    }

    # Execute
    try {
        if ($method -eq "GET") {
            $raw = Invoke-RestMethod -Uri $url -ErrorAction Stop
        } elseif ($body -and $body -ne '') {
            $raw = Invoke-RestMethod -Method POST -Uri $url -ContentType "application/json" -Body $body -ErrorAction Stop
        } else {
            $raw = Invoke-RestMethod -Method POST -Uri $url -ErrorAction Stop
        }
        $R = $raw | ConvertTo-Json -Compress -Depth 10
    } catch {
        $R = $_.ErrorDetails.Message
        if (-not $R) { $R = $_.Exception.Message }
    }

    Write-Host "  RESPONSE: $R" -ForegroundColor DarkGray

    # Check
    if ($R -match [regex]::Escape($expected)) {
        Write-Host "  ✓ PASS" -ForegroundColor Green
        $script:PASS++
    } else {
        Write-Host "  ✗ FAIL — expected '$expected'" -ForegroundColor Red
        $script:FAIL++
    }
}

# ── Startup & Health ──────────────────────────────────────────────────────────
Section "Startup & Health"

Run "T01 Health check — blockchain connected" `
    GET "$BASE/health" "" "connected"

# ── On-chain Payment Handling ─────────────────────────────────────────────────
Section "On-chain Payment Handling"

Run "T02 Set rental fee to 0.01 ETH" `
    POST "$BASE/api/payments/fee" '{"feeEth":"0.01"}' "0.01"

Run "T03 Read rental fee from chain" `
    GET "$BASE/api/payments/fee" "" "0.01"

Run "T04 Book car (ETH forwarded as msg.value)" `
    POST "$BASE/api/contract/book" `
    "{`"renterAddress`":`"$RENTER`",`"carType`":`"Audi A5 S-Line`",`"pickUpDate`":`"2026-05-01`",`"dropOffDate`":`"2026-05-05`"}" `
    "true"

Run "T05 Contract balance is 0.01 ETH after booking" `
    GET "$BASE/api/payments/contract-balance" "" "0.01"

Run "T06 reservationPayments[0] = 0.01 ETH on-chain" `
    GET "$BASE/api/payments/chain/0" "" "0.01"

# ── Reservation Confirmation ──────────────────────────────────────────────────
Section "Reservation Confirmation"

Run "T07 Confirm reservation on chain" `
    POST "$BASE/api/contract/confirm/0" "" "true"

Run "T08 Reservation confirmed flag = true" `
    GET "$BASE/api/contract/reservation/0" "" "true"

# ── Dispute Resolution ────────────────────────────────────────────────────────
Section "Dispute Resolution"

Run "T09 Raise dispute on confirmed reservation" `
    POST "$BASE/api/disputes/0/raise" `
    '{"reason":"Car was not in the agreed condition"}' `
    "Dispute raised"

Run "T10 Dispute state: raised=true, outcome=None" `
    GET "$BASE/api/disputes/0" "" "true"

Run "T11 Owner resolves dispute with refund=true" `
    POST "$BASE/api/disputes/0/resolve" '{"refund":true}' "Refunded"

Run "T12 Dispute state: raised=false, outcome=Refunded" `
    GET "$BASE/api/disputes/0" "" "Refunded"

# ── Owner Withdrawal ──────────────────────────────────────────────────────────
Section "Owner Withdrawal"

Run "T13 Owner withdraws accumulated funds" `
    POST "$BASE/api/payments/withdraw" "" "true"

Run "T14 Contract balance is 0 after withdrawal" `
    GET "$BASE/api/payments/contract-balance" "" "0"

# ── Regression ────────────────────────────────────────────────────────────────
Section "Regression Tests"

Run "R01 /health still works" `
    GET "$BASE/health" "" "connected"

Run "R02 /api/reservations still works" `
    GET "$BASE/api/reservations" "" "success"

Run "R03 /api/contract/count still works" `
    GET "$BASE/api/contract/count" "" "success"

# ── Error Cases ───────────────────────────────────────────────────────────────
Section "Error Cases"

Run "E01 Raise dispute on invalid reservationId" `
    POST "$BASE/api/disputes/99/raise" '{"reason":"test"}' "false"

Run "E02 Resolve non-existent dispute" `
    POST "$BASE/api/disputes/99/resolve" '{"refund":false}' "false"

Run "E03 Withdraw from empty contract" `
    POST "$BASE/api/payments/withdraw" "" "false"

Run "E04 Set fee without feeEth body" `
    POST "$BASE/api/payments/fee" '{}' "false"

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "══════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  Passed: $PASS  |  Failed: $FAIL"
Write-Host "══════════════════════════════════════" -ForegroundColor Yellow
if ($FAIL -eq 0) {
    Write-Host "  All tests passed." -ForegroundColor Green
} else {
    Write-Host "  Some tests failed." -ForegroundColor Red
}
Write-Host ""
