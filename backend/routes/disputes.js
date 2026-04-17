const router = require("express").Router();
const disputeController = require("../controllers/disputeController");

// POST /api/disputes/:reservationId/raise - renter raises a dispute
// Body: { reason: "Car was not available" }
router.post("/:reservationId/raise", disputeController.raiseDispute);

// POST /api/disputes/:reservationId/resolve - owner resolves the dispute
// Body: { refund: true | false }
router.post("/:reservationId/resolve", disputeController.resolveDispute);

// GET /api/disputes/:reservationId - get dispute status for a reservation
router.get("/:reservationId", disputeController.getDispute);

module.exports = router;
