const router = require("express").Router();
const gasController = require("../controllers/gasController");

// GET /api/gas/price - current gas price
router.get("/price", gasController.getCurrentGasPrice.bind(gasController));

// POST /api/gas/estimate - estimate gas for a single operation
// Body: { operation: "bookCar"|"confirmReservation"|"cancelReservation", params: {...} }
router.post("/estimate", gasController.estimateOperation.bind(gasController));

// POST /api/gas/estimate/batch - estimate gas for multiple operations
// Body: { operations: [{ operation, params }] }
router.post("/estimate/batch", gasController.estimateBatch.bind(gasController));

module.exports = router;
