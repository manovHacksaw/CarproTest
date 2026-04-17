const blockchainService = require("./blockchainService");

async function raiseDispute(reservationId, reason) {
  if (!reason || !reason.trim()) throw new Error("Dispute reason is required");
  const receipt = await blockchainService.raiseDisputeOnChain(reservationId, reason.trim());
  return { txHash: receipt.transactionHash, reservationId: Number(reservationId), reason: reason.trim() };
}

async function resolveDispute(reservationId, refund) {
  if (typeof refund !== "boolean") throw new Error("refund must be a boolean");
  const receipt = await blockchainService.resolveDisputeOnChain(reservationId, refund);
  return { txHash: receipt.transactionHash, reservationId: Number(reservationId), outcome: refund ? "Refunded" : "Rejected" };
}

async function getDispute(reservationId) {
  return blockchainService.getDisputeFromChain(reservationId);
}

module.exports = { raiseDispute, resolveDispute, getDispute };
