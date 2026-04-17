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
}

module.exports = new PaymentController();
