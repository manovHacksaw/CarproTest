const router = require("express").Router();
const walletService = require("../services/walletService");
const { successResponse, errorResponse, isValidEthAddress } = require("../utils/helpers");

// GET /api/wallet/:address/balance - ETH balance
router.get("/:address/balance", async (req, res) => {
  const { address } = req.params;
  if (!isValidEthAddress(address)) return errorResponse(res, "Invalid Ethereum address", 422);
  try {
    const balance = await walletService.getBalance(address);
    return successResponse(res, balance);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// GET /api/wallet/:address/nonce - transaction count / nonce
router.get("/:address/nonce", async (req, res) => {
  const { address } = req.params;
  if (!isValidEthAddress(address)) return errorResponse(res, "Invalid Ethereum address", 422);
  try {
    const result = await walletService.getTransactionCount(address);
    return successResponse(res, result);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// GET /api/wallet/:address/history - recent transaction history
router.get("/:address/history", async (req, res) => {
  const { address } = req.params;
  const { limit = 10 } = req.query;
  if (!isValidEthAddress(address)) return errorResponse(res, "Invalid Ethereum address", 422);
  try {
    const history = await walletService.getTransactionHistory(address, parseInt(limit));
    return successResponse(res, history);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// POST /api/wallet/validate - validate an Ethereum address
router.post("/validate", (req, res) => {
  const { address } = req.body;
  const valid = walletService.validateAddress(address);
  return successResponse(res, { address, valid });
});

// POST /api/wallet/estimate-transfer - estimate gas for ETH transfer
router.post("/estimate-transfer", async (req, res) => {
  const { from, to, amountEth } = req.body;
  if (!isValidEthAddress(from) || !isValidEthAddress(to))
    return errorResponse(res, "Valid from and to addresses required", 422);
  if (!amountEth || isNaN(parseFloat(amountEth)))
    return errorResponse(res, "Valid amountEth required", 422);
  try {
    const estimate = await walletService.estimateTransferGas(from, to, amountEth);
    return successResponse(res, estimate);
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
