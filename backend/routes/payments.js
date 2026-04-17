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

module.exports = router;
