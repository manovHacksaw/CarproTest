const router = require("express").Router();
const contractInteractionService = require("../services/contractInteractionService");
const blockchainService = require("../services/blockchainService");
const { successResponse, errorResponse, isValidEthAddress } = require("../utils/helpers");
const logger = require("../utils/logger");

// GET /api/contract/info - contract address, owner, authorized backend
router.get("/info", async (req, res) => {
  try {
    const [owner, authorizedBackend, reservationCount] = await Promise.all([
      contractInteractionService.getContractOwner(),
      contractInteractionService.getAuthorizedBackend(),
      contractInteractionService.getReservationCount(),
    ]);
    const info = await blockchainService.getContractInfo();
    return successResponse(res, { ...info, owner, authorizedBackend, reservationCount });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// GET /api/contract/reservation/:id - fetch single reservation from chain
router.get("/reservation/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, "Invalid reservation ID", 422);
    const reservation = await contractInteractionService.getReservationDetails(id);
    return successResponse(res, reservation);
  } catch (err) {
    return errorResponse(res, err.message, 404);
  }
});

// GET /api/contract/count - total reservation count on chain
router.get("/count", async (req, res) => {
  try {
    const count = await contractInteractionService.getReservationCount();
    return successResponse(res, { reservationCount: count });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// POST /api/contract/book - directly call bookCar on chain (admin/backend use)
router.post("/book", async (req, res) => {
  try {
    const { renterAddress, carType, pickUpDate, dropOffDate } = req.body;
    if (!renterAddress || !isValidEthAddress(renterAddress))
      return errorResponse(res, "Valid renterAddress required", 422);
    if (!carType || !pickUpDate || !dropOffDate)
      return errorResponse(res, "carType, pickUpDate, dropOffDate required", 422);

    const pickUpTs = Math.floor(new Date(pickUpDate).getTime() / 1000);
    const dropOffTs = Math.floor(new Date(dropOffDate).getTime() / 1000);

    const result = await contractInteractionService.executeBookCar(
      renterAddress, carType, pickUpTs, dropOffTs
    );
    logger.info("Direct chain booking executed", result);
    return successResponse(res, result, "Booking recorded on chain");
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// POST /api/contract/confirm/:id - confirm reservation on chain
router.post("/confirm/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, "Invalid reservation ID", 422);
    const result = await contractInteractionService.executeConfirmReservation(id);
    return successResponse(res, result, "Reservation confirmed on chain");
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// POST /api/contract/cancel/:id - cancel reservation on chain
router.post("/cancel/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return errorResponse(res, "Invalid reservation ID", 422);
    const result = await contractInteractionService.executeCancelReservation(id);
    return successResponse(res, result, "Reservation cancelled on chain");
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
