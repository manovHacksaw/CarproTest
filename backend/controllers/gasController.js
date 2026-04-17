const gasEstimationService = require("../services/gasEstimationService");
const { successResponse, errorResponse } = require("../utils/helpers");
const logger = require("../utils/logger");

class GasController {
  async estimateOperation(req, res) {
    try {
      const { operation, params } = req.body;
      const estimate = await gasEstimationService.estimateOperation(operation, params);
      return successResponse(res, estimate);
    } catch (err) {
      logger.error("Gas estimation error", { error: err.message });
      return errorResponse(res, err.message, 500);
    }
  }

  async getCurrentGasPrice(req, res) {
    try {
      const gasPrice = await gasEstimationService.getCurrentGasPrice();
      return successResponse(res, gasPrice);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async estimateBatch(req, res) {
    try {
      const { operations } = req.body;
      if (!Array.isArray(operations) || operations.length === 0)
        return errorResponse(res, "operations array is required", 422);

      const result = await gasEstimationService.estimateBatchOperations(operations);
      return successResponse(res, result);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }
}

module.exports = new GasController();
