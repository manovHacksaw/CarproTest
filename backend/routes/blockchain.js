const router = require("express").Router();
const blockchainService = require("../services/blockchainService");
const db = require("../models/db");
const { successResponse, errorResponse, isValidEthAddress } = require("../utils/helpers");

// GET /api/blockchain/status - network connection status
router.get("/status", async (req, res) => {
  const status = await blockchainService.checkConnection();
  return successResponse(res, status);
});

// GET /api/blockchain/reservations - all reservations from chain
router.get("/reservations", async (req, res) => {
  try {
    const reservations = await blockchainService.getAllReservationsFromChain();
    return successResponse(res, { count: reservations.length, reservations });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// GET /api/blockchain/reservations/:id - single reservation from chain
router.get("/reservations/:id", async (req, res) => {
  try {
    const reservation = await blockchainService.getReservationFromChain(parseInt(req.params.id));
    return successResponse(res, reservation);
  } catch (err) {
    return errorResponse(res, err.message, 404);
  }
});

// GET /api/blockchain/balance/:address - wallet ETH balance
router.get("/balance/:address", async (req, res) => {
  const { address } = req.params;
  if (!isValidEthAddress(address)) return errorResponse(res, "Invalid Ethereum address", 422);
  try {
    const balance = await blockchainService.getWalletBalance(address);
    return successResponse(res, { address, balanceEth: balance });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// GET /api/blockchain/tx/:hash - transaction details
router.get("/tx/:hash", async (req, res) => {
  try {
    const details = await blockchainService.getTransactionDetails(req.params.hash);
    return successResponse(res, details);
  } catch (err) {
    return errorResponse(res, err.message, 404);
  }
});

// GET /api/blockchain/events - all saved contract events
router.get("/events", (req, res) => {
  const events = db.getEvents();
  return successResponse(res, { count: events.length, events });
});

// GET /api/blockchain/count - total reservation count from chain
router.get("/count", async (req, res) => {
  try {
    const count = await blockchainService.getReservationCount();
    return successResponse(res, { reservationCount: count });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// GET /api/blockchain/renter/:address/reservations - reservation IDs for a renter
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

// GET /api/blockchain/stats/total-days - total rental days across all reservations
router.get("/stats/total-days", async (req, res) => {
  try {
    const totalDays = await blockchainService.getTotalRentalDaysFromChain();
    return successResponse(res, { totalRentalDays: totalDays });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
