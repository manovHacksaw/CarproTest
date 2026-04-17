const blockchainService = require("../services/blockchainService");
const contractEventService = require("../services/contractEventService");
const gasEstimationService = require("../services/gasEstimationService");
const { successResponse, errorResponse } = require("../utils/helpers");

class BlockchainController {
  async getStatus(req, res) {
    try {
      const status = await blockchainService.checkConnection();
      return successResponse(res, status);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getBalance(req, res) {
    try {
      const { address } = req.params;
      const balance = await blockchainService.getWalletBalance(address);
      return successResponse(res, { address, balanceEth: balance });
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getTransaction(req, res) {
    try {
      const { hash } = req.params;
      const details = await blockchainService.getTransactionDetails(hash);
      return successResponse(res, details);
    } catch (err) {
      return errorResponse(res, err.message, 404);
    }
  }

  async getEvents(req, res) {
    try {
      const { eventType, fromBlock, toBlock } = req.query;
      const events = await contractEventService.queryEvents(eventType, fromBlock, toBlock);
      return successResponse(res, { count: events.length, events });
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async estimateGas(req, res) {
    try {
      const { operation, params } = req.body;
      const estimate = await gasEstimationService.estimateOperation(operation, params);
      return successResponse(res, estimate);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }

  async getContractInfo(req, res) {
    try {
      const info = await blockchainService.getContractInfo();
      return successResponse(res, info);
    } catch (err) {
      return errorResponse(res, err.message, 500);
    }
  }
}

module.exports = new BlockchainController();
