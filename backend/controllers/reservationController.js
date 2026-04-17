const reservationService = require("../services/reservationService");
const blockchainService = require("../services/blockchainService");
const { successResponse, errorResponse } = require("../utils/helpers");
const logger = console;

class ReservationController {
  async create(req, res) {
    try {
      const reservation = await reservationService.createReservation(req.body);
      logger.info("Reservation created via controller", { id: reservation.id });
      return successResponse(res, reservation, "Reservation created", 201);
    } catch (err) {
      logger.error("Create reservation failed", { error: err.message });
      return errorResponse(res, err.message);
    }
  }

  async confirm(req, res) {
    try {
      const { id } = req.params;
      const { txHash } = req.body;
      const updated = await reservationService.confirmReservation(id, txHash);
      return successResponse(res, updated, "Reservation confirmed");
    } catch (err) {
      return errorResponse(res, err.message);
    }
  }

  async cancel(req, res) {
    try {
      const { id } = req.params;
      const { renterAddress } = req.body;
      const cancelled = await reservationService.cancelReservation(id, renterAddress);
      return successResponse(res, cancelled, "Reservation cancelled");
    } catch (err) {
      return errorResponse(res, err.message);
    }
  }

  async syncFromChain(req, res) {
    try {
      const synced = await reservationService.syncChainReservations();
      return successResponse(res, synced, "Synced from blockchain");
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getChainReservation(req, res) {
    try {
      const { id } = req.params;
      const reservation = await blockchainService.getReservationFromChain(parseInt(id));
      return successResponse(res, reservation);
    } catch (err) {
      return errorResponse(res, err.message, 404);
    }
  }
}

module.exports = new ReservationController();
