const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const { JWT_SECRET } = require("../config/config");
const { errorResponse } = require("../utils/helpers");
const logger = console;

/**
 * Verify JWT token from Authorization header
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, "No token provided", 401);
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn("Invalid JWT", { error: err.message });
    return errorResponse(res, "Invalid or expired token", 401);
  }
}

/**
 * Generate a JWT for a wallet address after signature verification
 */
function generateToken(address) {
  return jwt.sign({ address }, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verify an Ethereum signed message (wallet auth)
 * The frontend signs a nonce with MetaMask, we verify here
 */
function verifySignature(address, message, signature) {
  try {
    const recovered = ethers.utils.verifyMessage(message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

module.exports = { requireAuth, generateToken, verifySignature };
