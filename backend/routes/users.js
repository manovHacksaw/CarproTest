const router = require("express").Router();
const db = require("../models/db");
const { generateToken, verifySignature } = require("../middleware/auth");
const { validateWalletAuth } = require("../middleware/validate");
const { successResponse, errorResponse, isValidEthAddress } = require("../utils/helpers");

// POST /api/users/auth - wallet signature login
router.post("/auth", validateWalletAuth, (req, res) => {
  const { address, signature, message } = req.body;
  const valid = verifySignature(address, message, signature);
  if (!valid) return errorResponse(res, "Signature verification failed", 401);
  db.upsertUser(address, { lastLogin: new Date().toISOString() });
  const token = generateToken(address);
  return successResponse(res, { token, address }, "Authenticated");
});

// GET /api/users/:address
router.get("/:address", (req, res) => {
  const { address } = req.params;
  if (!isValidEthAddress(address)) return errorResponse(res, "Invalid address", 422);
  const user = db.getUserByAddress(address);
  if (!user) return errorResponse(res, "User not found", 404);
  return successResponse(res, user);
});

// GET /api/users/:address/reservations
router.get("/:address/reservations", (req, res) => {
  const { address } = req.params;
  if (!isValidEthAddress(address)) return errorResponse(res, "Invalid address", 422);
  const reservations = db.getReservationsByAddress(address);
  return successResponse(res, reservations);
});

// GET /api/users/:address/payments
router.get("/:address/payments", (req, res) => {
  const { address } = req.params;
  if (!isValidEthAddress(address)) return errorResponse(res, "Invalid address", 422);
  const payments = db.getPayments().filter(
    (p) => p.renterAddress.toLowerCase() === address.toLowerCase()
  );
  return successResponse(res, payments);
});

module.exports = router;
