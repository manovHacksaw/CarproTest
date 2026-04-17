const paymentService = require("../services/paymentService");
const db = require("../models/db");
const { successResponse, errorResponse } = require("../utils/helpers");
const logger = require("../utils/logger");

class PaymentController {
  async verifyPayment(req, res) {
    try {
      const { txHash, expectedAmountEth, renterAddress } = req.body;
      const result = await paymentService.verifyPayment(txHash, expectedAmountEth, renterAddress);
      return successResponse(res, result, result.valid ? "Payment verified" : "Payment invalid");
    } catch (err) {
      logger.error("Payment verification error", { error: err.message });
      return errorResponse(res, err.message, 500);
    }
  }

  async getPaymentByReservation(req, res) {
    try {
      const { reservationId } = req.params;
      const payment = await paymentService.getPaymentByReservation(reservationId);
      if (!payment) return errorResponse(res, "Payment not found", 404);
      return successResponse(res, payment);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getAllPayments(req, res) {
    try {
      const payments = db.getPayments();
      return successResponse(res, { count: payments.length, payments });
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getTotalRevenue(req, res) {
    try {
      const totalEth = await paymentService.getTotalRevenue();
      return successResponse(res, { totalRevenueEth: totalEth });
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  // ── On-chain payment handlers ─────────────────────────────────────────────────

  async getRentalFee(req, res) {
    try {
      const fee = await paymentService.getChainFee();
      return successResponse(res, fee, "Current rental fee");
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getContractBalance(req, res) {
    try {
      const balance = await paymentService.getChainBalance();
      return successResponse(res, balance, "Contract balance");
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getReservationPayment(req, res) {
    try {
      const { reservationId } = req.params;
      const payment = await paymentService.getChainReservationPayment(reservationId);
      return successResponse(res, { reservationId: Number(reservationId), ...payment });
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async setRentalFee(req, res) {
    try {
      const { feeEth } = req.body;
      if (feeEth === undefined || feeEth === null) return errorResponse(res, "feeEth is required", 422);
      const result = await paymentService.setFee(feeEth);
      return successResponse(res, result, "Rental fee updated");
    } catch (err) {
      logger.error("setRentalFee error", { error: err.message });
      return errorResponse(res, err.message, 500);
    }
  }

  async withdrawFunds(req, res) {
    try {
      const result = await paymentService.withdraw();
      return successResponse(res, result, "Funds withdrawn successfully");
    } catch (err) {
      logger.error("Withdraw error", { error: err.message });
      return errorResponse(res, err.message, 500);
    }
  }
}

module.exports = new PaymentController();
