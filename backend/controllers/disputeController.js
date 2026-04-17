const disputeService = require("../services/disputeService");
const { successResponse, errorResponse } = require("../utils/helpers");
const logger = require("../utils/logger");

async function raiseDispute(req, res) {
  try {
    const { reservationId } = req.params;
    const { reason } = req.body;
    const result = await disputeService.raiseDispute(reservationId, reason);
    return successResponse(res, result, "Dispute raised", 201);
  } catch (err) {
    logger.error("raiseDispute error", { error: err.message });
    return errorResponse(res, err.message, 400);
  }
}

async function resolveDispute(req, res) {
  try {
    const { reservationId } = req.params;
    const { refund } = req.body;
    if (refund === undefined || refund === null) return errorResponse(res, "refund (boolean) is required", 422);
    const result = await disputeService.resolveDispute(reservationId, Boolean(refund));
    return successResponse(res, result, "Dispute resolved");
  } catch (err) {
    logger.error("resolveDispute error", { error: err.message });
    return errorResponse(res, err.message, 400);
  }
}

async function getDispute(req, res) {
  try {
    const { reservationId } = req.params;
    const dispute = await disputeService.getDispute(reservationId);
    return successResponse(res, { reservationId: Number(reservationId), ...dispute });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
}

module.exports = { raiseDispute, resolveDispute, getDispute };
