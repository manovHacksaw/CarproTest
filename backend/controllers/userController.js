const db = require("../models/db");
const { generateToken, verifySignature } = require("../middleware/auth");
const paymentService = require("../services/paymentService");
const walletService = require("../services/walletService");
const { successResponse, errorResponse, isValidEthAddress } = require("../utils/helpers");
const logger = require("../utils/logger");

class UserController {
  async authenticate(req, res) {
    try {
      const { address, signature, message } = req.body;
      const valid = verifySignature(address, message, signature);
      if (!valid) return errorResponse(res, "Signature verification failed", 401);

      db.upsertUser(address, { lastLogin: new Date().toISOString() });
      const token = generateToken(address);
      logger.info("User authenticated", { address });
      return successResponse(res, { token, address }, "Authenticated");
    } catch (err) {
      logger.error("Auth failed", { error: err.message });
      return errorResponse(res, err.message, 500);
    }
  }

  async getProfile(req, res) {
    try {
      const { address } = req.params;
      if (!isValidEthAddress(address)) return errorResponse(res, "Invalid address", 422);

      const user = db.getUserByAddress(address);
      if (!user) return errorResponse(res, "User not found", 404);

      const walletBalance = await walletService.getBalance(address).catch(() => null);
      return successResponse(res, { ...user, walletBalance });
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getReservations(req, res) {
    try {
      const { address } = req.params;
      if (!isValidEthAddress(address)) return errorResponse(res, "Invalid address", 422);

      const reservations = db.getReservationsByAddress(address);
      return successResponse(res, reservations);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getPayments(req, res) {
    try {
      const { address } = req.params;
      if (!isValidEthAddress(address)) return errorResponse(res, "Invalid address", 422);

      const payments = await paymentService.getPaymentsByAddress(address);
      return successResponse(res, payments);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getWalletInfo(req, res) {
    try {
      const { address } = req.params;
      if (!isValidEthAddress(address)) return errorResponse(res, "Invalid address", 422);

      const [balance, txCount] = await Promise.all([
        walletService.getBalance(address),
        walletService.getTransactionCount(address),
      ]);

      return successResponse(res, { ...balance, ...txCount });
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }
}

module.exports = new UserController();
