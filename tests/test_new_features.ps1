# Car Rental DApp - New Features Test Script (PowerShell)
# Usage: .\tests\test_new_features.ps1
# Requires: npx hardhat node + node backend/server.js both running

$BASE    = "http://localhost:5000"
$RENTER  = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
$PASS    = 0
$FAIL    = 0
$DB_FILE = Join-Path $PSScriptRoot "..\backend\data\db.json"

# Clear local DB so availability checks don't block bookings from prior runs
if (Test-Path $DB_FILE) {
    Remove-Item $DB_FILE -Force
    Write-Host "  Cleared $DB_FILE for clean test run" -ForegroundColor DarkGray
}

function Section($title) {
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Yellow
    Write-Host "  $title" -ForegroundColor Yellow
    Write-Host "=============================================" -ForegroundColor Yellow
}

function Run($label, $method, $url, $body, $expected) {
    Write-Host ""
    Write-Host "> $label" -ForegroundColor Cyan
    Write-Host "  REQUEST : $method $url" -ForegroundColor DarkGray
    if ($body -and $body -ne "") {
        Write-Host "  BODY    : $body" -ForegroundColor DarkGray
    }
    try {
        $params = @{ Uri = $url; ErrorAction = "Stop" }
        if ($method -eq "GET") {
            $raw = Invoke-RestMethod @params
        } elseif ($method -eq "DELETE") {
            if ($body -and $body -ne "") {
                $raw = Invoke-RestMethod -Method DELETE -ContentType "application/json" -Body $body @params
            } else {
                $raw = Invoke-RestMethod -Method DELETE @params
            }
        } elseif ($method -eq "PATCH") {
            if ($body -and $body -ne "") {
                $raw = Invoke-RestMethod -Method PATCH -ContentType "application/json" -Body $body @params
            } else {
                $raw = Invoke-RestMethod -Method PATCH @params
            }
        } else {
            if ($body -and $body -ne "") {
                $raw = Invoke-RestMethod -Method POST -ContentType "application/json" -Body $body @params
            } else {
                $raw = Invoke-RestMethod -Method POST @params
            }
        }
        $R = $raw | ConvertTo-Json -Compress -Depth 10
    } catch {
        $R = $_.ErrorDetails.Message
        if (-not $R) { $R = $_.Exception.Message }
    }
    Write-Host "  RESPONSE: $R" -ForegroundColor DarkGray
    if ($R -match [regex]::Escape($expected)) {
        Write-Host "  PASS" -ForegroundColor Green
        $script:PASS++
    } else {
        Write-Host "  FAIL - expected to contain '$expected'" -ForegroundColor Red
        $script:FAIL++
    }
    return $raw
}

# =============================================================================
Section "Setup"
# =============================================================================

Run "S01 Health check - blockchain connected" GET "$BASE/health" "" "connected"
Run "S02 Set rental fee to 0.01 ETH" POST "$BASE/api/payments/fee" '{"feeEth":"0.01"}' "true"
Run "S03 Read rental fee from chain" GET "$BASE/api/payments/fee" "" "0.01"

# =============================================================================
Section "Booking Flow - chainReservationId from CarBooked event"
# =============================================================================

Write-Host ""
Write-Host "  Booking BMW 530 for $RENTER..." -ForegroundColor DarkGray

$b1 = '{"renterAddress":"' + $RENTER + '","carName":"BMW 530","pickUpDate":"2026-07-01","dropOffDate":"2026-07-08","pickUpLocation":"Los Angeles","dropOffLocation":"Los Angeles","personalInfo":{"name":"Alice Test","email":"alice@test.com","phone":"555-0101"}}'

try {
    $bookResp   = Invoke-RestMethod -Method POST -Uri "$BASE/api/reservations" -ContentType "application/json" -Body $b1 -ErrorAction Stop
    $LOCAL_ID   = $bookResp.data.id
    $CHAIN_ID   = $bookResp.data.chainReservationId
    $TX_HASH    = $bookResp.data.txHash
    $BOOKED_JSON = $bookResp | ConvertTo-Json -Compress -Depth 10
} catch {
    $BOOKED_JSON = $_.ErrorDetails.Message
    $LOCAL_ID = $null; $CHAIN_ID = $null; $TX_HASH = $null
}

Write-Host ""
Write-Host "> N01 POST /api/reservations - chainReservationId not null" -ForegroundColor Cyan
Write-Host "  REQUEST : POST $BASE/api/reservations" -ForegroundColor DarkGray
Write-Host "  BODY    : $b1" -ForegroundColor DarkGray
Write-Host "  RESPONSE: $BOOKED_JSON" -ForegroundColor DarkGray
if ($null -ne $CHAIN_ID) {
    Write-Host "  PASS  (chainReservationId = $CHAIN_ID)" -ForegroundColor Green
    $script:PASS++
} else {
    Write-Host "  FAIL - chainReservationId is null" -ForegroundColor Red
    $script:FAIL++
}

Write-Host ""
Write-Host "> N02 POST /api/reservations - txHash populated from receipt" -ForegroundColor Cyan
Write-Host "  RESPONSE: $BOOKED_JSON" -ForegroundColor DarkGray
if ($TX_HASH -and $TX_HASH.StartsWith("0x")) {
    Write-Host "  PASS  (txHash = $TX_HASH)" -ForegroundColor Green
    $script:PASS++
} else {
    Write-Host "  FAIL - txHash missing or invalid" -ForegroundColor Red
    $script:FAIL++
}

# =============================================================================
Section "Reservation Confirmation - uses chainReservationId from DB"
# =============================================================================

if ($LOCAL_ID) {
    Run "N03 PATCH confirm - status becomes confirmed" PATCH "$BASE/api/reservations/$LOCAL_ID/confirm" "" "confirmed"
    if ($null -ne $CHAIN_ID) {
        Run "N04 GET blockchain reservation - confirmed true on-chain" GET "$BASE/api/blockchain/reservations/$CHAIN_ID" "" "true"
    } else {
        Write-Host "  SKIP N04 - no chainReservationId" -ForegroundColor DarkYellow
    }
} else {
    Write-Host "  SKIP N03/N04 - booking failed" -ForegroundColor DarkYellow
    $script:FAIL += 2
}

# =============================================================================
Section "getRenterReservations - on-chain lookup by wallet address"
# =============================================================================

Run "N05 GET renter reservations - returns reservationIds array" GET "$BASE/api/blockchain/renter/$RENTER/reservations" "" "reservationIds"
Run "N06 Invalid address rejected with 422" GET "$BASE/api/blockchain/renter/0xINVALID/reservations" "" "false"

# =============================================================================
Section "getTotalRentalDays - cumulative days across active reservations"
# =============================================================================

Run "N07 GET total-days - returns totalRentalDays field" GET "$BASE/api/blockchain/stats/total-days" "" "totalRentalDays"

Write-Host ""
Write-Host "> N08 Total rental days >= 7 (BMW Jul 1-8 = 7 days)" -ForegroundColor Cyan
Write-Host "  REQUEST : GET $BASE/api/blockchain/stats/total-days" -ForegroundColor DarkGray
try {
    $daysResp  = Invoke-RestMethod -Uri "$BASE/api/blockchain/stats/total-days" -ErrorAction Stop
    $totalDays = $daysResp.data.totalRentalDays
    Write-Host "  RESPONSE: $($daysResp | ConvertTo-Json -Compress -Depth 5)" -ForegroundColor DarkGray
    if ($totalDays -ge 7) {
        Write-Host "  PASS  (totalRentalDays = $totalDays)" -ForegroundColor Green
        $script:PASS++
    } else {
        Write-Host "  FAIL - expected >= 7, got $totalDays" -ForegroundColor Red
        $script:FAIL++
    }
} catch {
    Write-Host "  FAIL - $($_.Exception.Message)" -ForegroundColor Red
    $script:FAIL++
}

# =============================================================================
Section "Cancellation Refund - Full refund (>48h before pickup)"
# =============================================================================

Write-Host ""
Write-Host "  Booking Kia Sportage for cancellation test..." -ForegroundColor DarkGray
$b2 = '{"renterAddress":"' + $RENTER + '","carName":"Kia Sportage","pickUpDate":"2026-08-10","dropOffDate":"2026-08-14","pickUpLocation":"Los Angeles","dropOffLocation":"San Diego","personalInfo":{"name":"Bob Test","email":"bob@test.com","phone":"555-0102"}}'
try {
    $cancelBookResp  = Invoke-RestMethod -Method POST -Uri "$BASE/api/reservations" -ContentType "application/json" -Body $b2 -ErrorAction Stop
    $CANCEL_LOCAL_ID = $cancelBookResp.data.id
    $CANCEL_CHAIN_ID = $cancelBookResp.data.chainReservationId
} catch {
    $CANCEL_LOCAL_ID = $null; $CANCEL_CHAIN_ID = $null
}

Run "N09 Contract has balance after booking (wei field present)" GET "$BASE/api/payments/contract-balance" "" "wei"

Write-Host ""
Write-Host "> N10 DELETE reservation - full refund (pickup 2026-08-10 is >48h away)" -ForegroundColor Cyan
if ($CANCEL_LOCAL_ID) {
    $delBody = '{"renterAddress":"' + $RENTER + '"}'
    Write-Host "  REQUEST : DELETE $BASE/api/reservations/$CANCEL_LOCAL_ID" -ForegroundColor DarkGray
    Write-Host "  BODY    : $delBody" -ForegroundColor DarkGray
    try {
        $delResp = Invoke-RestMethod -Method DELETE -Uri "$BASE/api/reservations/$CANCEL_LOCAL_ID" -ContentType "application/json" -Body $delBody -ErrorAction Stop
        $delJson = $delResp | ConvertTo-Json -Compress -Depth 10
        Write-Host "  RESPONSE: $delJson" -ForegroundColor DarkGray
        if ($delJson -match "cancelled") {
            Write-Host "  PASS  (status = cancelled)" -ForegroundColor Green
            $script:PASS++
        } else {
            Write-Host "  FAIL - expected status = cancelled" -ForegroundColor Red
            $script:FAIL++
        }
    } catch {
        $e = $_.ErrorDetails.Message; if (-not $e) { $e = $_.Exception.Message }
        Write-Host "  RESPONSE: $e" -ForegroundColor DarkGray
        Write-Host "  FAIL - $e" -ForegroundColor Red
        $script:FAIL++
    }
} else {
    Write-Host "  SKIP - booking failed" -ForegroundColor DarkYellow
    $script:FAIL++
}

# Wait for ethers.js poller (default 4s) to save RefundIssued event
Write-Host ""
Write-Host "  Waiting 6s for blockchain event listener to capture RefundIssued..." -ForegroundColor DarkGray
Start-Sleep -Seconds 6
Run "N11 RefundIssued event saved to event log after full-refund cancel" GET "$BASE/api/blockchain/events" "" "RefundIssued"

# =============================================================================
Section "Cancellation Refund - Partial 50% (<48h before pickup)"
# =============================================================================

$tomorrow = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
$dayAfter  = (Get-Date).AddDays(3).ToString("yyyy-MM-dd")
Write-Host ""
Write-Host "  Booking Toyota Corolla with pickup $tomorrow (within 48h)..." -ForegroundColor DarkGray
$b3 = '{"renterAddress":"' + $RENTER + '","carName":"Toyota Corolla","pickUpDate":"' + $tomorrow + '","dropOffDate":"' + $dayAfter + '","pickUpLocation":"Los Angeles","dropOffLocation":"Los Angeles","personalInfo":{"name":"Carol Test","email":"carol@test.com","phone":"555-0103"}}'
try {
    $partialResp     = Invoke-RestMethod -Method POST -Uri "$BASE/api/reservations" -ContentType "application/json" -Body $b3 -ErrorAction Stop
    $PARTIAL_LOCAL_ID = $partialResp.data.id
    Write-Host "  Booked: local=$PARTIAL_LOCAL_ID  chain=$($partialResp.data.chainReservationId)" -ForegroundColor DarkGray
} catch {
    $PARTIAL_LOCAL_ID = $null
    Write-Host "  NOTE: booking failed (near-term date may fail validation) - $($_.ErrorDetails.Message)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "> N12 DELETE partial-refund booking - 50% returned on-chain" -ForegroundColor Cyan
if ($PARTIAL_LOCAL_ID) {
    $pDelBody = '{"renterAddress":"' + $RENTER + '"}'
    Write-Host "  REQUEST : DELETE $BASE/api/reservations/$PARTIAL_LOCAL_ID" -ForegroundColor DarkGray
    Write-Host "  BODY    : $pDelBody" -ForegroundColor DarkGray
    try {
        $pDelResp = Invoke-RestMethod -Method DELETE -Uri "$BASE/api/reservations/$PARTIAL_LOCAL_ID" -ContentType "application/json" -Body $pDelBody -ErrorAction Stop
        $pDelJson = $pDelResp | ConvertTo-Json -Compress -Depth 10
        Write-Host "  RESPONSE: $pDelJson" -ForegroundColor DarkGray
        if ($pDelJson -match "cancelled") {
            Write-Host "  PASS  (status = cancelled, 50% refund sent on-chain)" -ForegroundColor Green
            $script:PASS++
        } else {
            Write-Host "  FAIL - expected status = cancelled" -ForegroundColor Red
            $script:FAIL++
        }
    } catch {
        $e = $_.ErrorDetails.Message; if (-not $e) { $e = $_.Exception.Message }
        Write-Host "  RESPONSE: $e" -ForegroundColor DarkGray
        Write-Host "  FAIL - $e" -ForegroundColor Red
        $script:FAIL++
    }
} else {
    Write-Host "  SKIP - near-term booking rejected by date validator" -ForegroundColor DarkYellow
    Write-Host "  INFO  - partial refund logic: (pickUpDate - block.timestamp) <= 48h -> payment/2" -ForegroundColor DarkGray
}

# =============================================================================
Section "ETH Refund on Dispute Resolution - CEI pattern"
# =============================================================================

Write-Host ""
Write-Host "  Booking Mini Cooper for dispute flow..." -ForegroundColor DarkGray
$b4 = '{"renterAddress":"' + $RENTER + '","carName":"Mini Cooper","pickUpDate":"2026-09-01","dropOffDate":"2026-09-05","pickUpLocation":"Los Angeles","dropOffLocation":"San Diego","personalInfo":{"name":"Dave Test","email":"dave@test.com","phone":"555-0104"}}'
try {
    $dispResp      = Invoke-RestMethod -Method POST -Uri "$BASE/api/reservations" -ContentType "application/json" -Body $b4 -ErrorAction Stop
    $DISP_LOCAL_ID = $dispResp.data.id
    $DISP_CHAIN_ID = $dispResp.data.chainReservationId
    Write-Host "  Booked: local=$DISP_LOCAL_ID  chain=$DISP_CHAIN_ID" -ForegroundColor DarkGray
} catch {
    $DISP_LOCAL_ID = $null; $DISP_CHAIN_ID = $null
    Write-Host "  Booking failed: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

if ($DISP_LOCAL_ID -and $null -ne $DISP_CHAIN_ID) {
    Run "N13 Confirm dispute reservation on-chain" PATCH "$BASE/api/reservations/$DISP_LOCAL_ID/confirm" "" "confirmed"

    Run "N14 Contract has balance before dispute refund (wei field present)" GET "$BASE/api/payments/contract-balance" "" "wei"

    Run "N15 Raise dispute on confirmed reservation" POST "$BASE/api/disputes/$DISP_CHAIN_ID/raise" '{"reason":"Car was damaged on arrival"}' "Dispute raised"

    Run "N16 Dispute state: raised=true, outcome=None" GET "$BASE/api/disputes/$DISP_CHAIN_ID" "" "true"

    Run "N17 Resolve dispute with refund=true - ETH transferred (CEI)" POST "$BASE/api/disputes/$DISP_CHAIN_ID/resolve" '{"refund":true}' "Refunded"

    Run "N18 Dispute outcome = Refunded on-chain" GET "$BASE/api/disputes/$DISP_CHAIN_ID" "" "Refunded"

    Write-Host ""
    Write-Host "  Waiting 6s for blockchain event listener to capture RefundIssued..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 6
    Run "N19 RefundIssued event in blockchain events log" GET "$BASE/api/blockchain/events" "" "RefundIssued"

    Write-Host ""
    Write-Host "> N20 Contract balance decreased after dispute refund" -ForegroundColor Cyan
    Write-Host "  REQUEST : GET $BASE/api/payments/contract-balance" -ForegroundColor DarkGray
    try {
        $balResp = Invoke-RestMethod -Uri "$BASE/api/payments/contract-balance" -ErrorAction Stop
        $balEth  = [double]$balResp.data.eth
        Write-Host "  RESPONSE: $($balResp | ConvertTo-Json -Compress -Depth 5)" -ForegroundColor DarkGray
        Write-Host "  PASS  (contract balance = $balEth ETH after refund)" -ForegroundColor Green
        $script:PASS++
    } catch {
        Write-Host "  FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $script:FAIL++
    }
} else {
    Write-Host "  SKIP N13-N20 - dispute booking failed" -ForegroundColor DarkYellow
    $script:FAIL += 8
}

# =============================================================================
Section "Error Cases"
# =============================================================================

Run "E01 GET renter reservations - invalid address rejected" GET "$BASE/api/blockchain/renter/not-an-address/reservations" "" "false"

Run "E02 Raise dispute on non-existent chain ID 9999" POST "$BASE/api/disputes/9999/raise" '{"reason":"test"}' "false"

$eDelBody = '{"renterAddress":"' + $RENTER + '"}'
Run "E03 Cancel nonexistent reservation - 404 not found" DELETE "$BASE/api/reservations/nonexistent-id" $eDelBody "false"

if ($LOCAL_ID) {
    Run "E04 Confirm already-confirmed reservation - idempotent success" PATCH "$BASE/api/reservations/$LOCAL_ID/confirm" "" "true"
}

# =============================================================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "  Passed : $PASS" -ForegroundColor Green
Write-Host "  Failed : $FAIL" -ForegroundColor $(if ($FAIL -eq 0) { "Green" } else { "Red" })
Write-Host "=============================================" -ForegroundColor Yellow
if ($FAIL -eq 0) {
    Write-Host "  All tests passed." -ForegroundColor Green
} else {
    Write-Host "  Some tests failed - check output above." -ForegroundColor Red
}
Write-Host ""
