const analyticsService = require("../services/analyticsService");
const { successResponse, errorResponse } = require("../utils/helpers");

class AnalyticsController {
  async getOverview(req, res) {
    try {
      const overview = await analyticsService.getOverview();
      return successResponse(res, overview);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getCarStats(req, res) {
    try {
      const stats = await analyticsService.getCarStatistics();
      return successResponse(res, stats);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getRevenueReport(req, res) {
    try {
      const { startDate, endDate } = req.query;
      const report = await analyticsService.getRevenueReport(startDate, endDate);
      return successResponse(res, report);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getUserMetrics(req, res) {
    try {
      const metrics = await analyticsService.getUserMetrics();
      return successResponse(res, metrics);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getBlockchainMetrics(req, res) {
    try {
      const metrics = await analyticsService.getBlockchainMetrics();
      return successResponse(res, metrics);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }
}

module.exports = new AnalyticsController();
