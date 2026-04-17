const router = require("express").Router();
const paymentController = require("../controllers/paymentController");

// GET /api/payments - all payments
router.get("/", paymentController.getAllPayments.bind(paymentController));

// GET /api/payments/revenue - total revenue
router.get("/revenue", paymentController.getTotalRevenue.bind(paymentController));

// GET /api/payments/reservation/:reservationId - payment for a reservation
router.get("/reservation/:reservationId", paymentController.getPaymentByReservation.bind(paymentController));

// POST /api/payments/verify - verify a payment transaction
// Body: { txHash, expectedAmountEth, renterAddress }
router.post("/verify", paymentController.verifyPayment.bind(paymentController));

// ── On-chain payment routes ───────────────────────────────────────────────────

// GET /api/payments/fee - current rentalFee from chain
router.get("/fee", paymentController.getRentalFee.bind(paymentController));

// GET /api/payments/contract-balance - ETH held in contract right now
router.get("/contract-balance", paymentController.getContractBalance.bind(paymentController));

// GET /api/payments/chain/:reservationId - payment recorded on-chain for a booking
router.get("/chain/:reservationId", paymentController.getReservationPayment.bind(paymentController));

// POST /api/payments/fee - owner sets a new rental fee
// Body: { feeEth: "0.01" }
router.post("/fee", paymentController.setRentalFee.bind(paymentController));

// POST /api/payments/withdraw - owner withdraws all accumulated funds
router.post("/withdraw", paymentController.withdrawFunds.bind(paymentController));

module.exports = router;
