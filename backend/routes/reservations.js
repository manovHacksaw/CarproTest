const router = require("express").Router();
const reservationService = require("../services/reservationService");
const db = require("../models/db");
const { requireAuth } = require("../middleware/auth");
const { validateBooking } = require("../middleware/validate");
const { bookingLimiter } = require("../middleware/rateLimiter");
const { successResponse, errorResponse, paginate } = require("../utils/helpers");

// POST /api/reservations - create a new reservation
router.post("/", bookingLimiter, validateBooking, async (req, res) => {
  try {
    const reservation = await reservationService.createReservation(req.body);
    return successResponse(res, reservation, "Reservation created", 201);
  } catch (err) {
    return errorResponse(res, err.message);
  }
});

// GET /api/reservations - list all (admin view, no auth for demo)
router.get("/", (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  let reservations = db.getReservations();
  if (status) reservations = reservations.filter((r) => r.status === status);
  reservations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return successResponse(res, paginate(reservations, page, limit));
});

// GET /api/reservations/chain - fetch all reservations directly from blockchain
router.get("/chain", async (req, res) => {
  try {
    const chainData = await reservationService.syncChainReservations();
    return successResponse(res, chainData, "Synced from blockchain");
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// GET /api/reservations/address/:address - reservations by wallet address
router.get("/address/:address", (req, res) => {
  const { address } = req.params;
  const { status } = req.query;
  let reservations = db.getReservationsByAddress(address);
  if (status) reservations = reservations.filter((r) => r.status === status);
  return successResponse(res, reservations);
});

// GET /api/reservations/:id - single reservation
router.get("/:id", (req, res) => {
  const reservation = db.getReservationById(req.params.id);
  if (!reservation) return errorResponse(res, "Reservation not found", 404);
  return successResponse(res, reservation);
});

// PATCH /api/reservations/:id/confirm - confirm on-chain using stored chainReservationId
router.patch("/:id/confirm", async (req, res) => {
  try {
    const updated = await reservationService.confirmReservation(req.params.id);
    return successResponse(res, updated, "Reservation confirmed");
  } catch (err) {
    return errorResponse(res, err.message);
  }
});

// DELETE /api/reservations/:id - cancel reservation
router.delete("/:id", async (req, res) => {
  const { renterAddress } = req.body;
  if (!renterAddress) return errorResponse(res, "renterAddress required", 422);
  try {
    const updated = await reservationService.cancelReservation(req.params.id, renterAddress);
    return successResponse(res, updated, "Reservation cancelled");
  } catch (err) {
    return errorResponse(res, err.message);
  }
});

module.exports = router;
