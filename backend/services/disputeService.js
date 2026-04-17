const blockchainService = require("./blockchainService");

async function raiseDispute(reservationId, reason) {
  if (!reason || !reason.trim()) throw new Error("Dispute reason is required");
  const id = Number(reservationId);
  if (isNaN(id)) throw new Error("Invalid reservation ID");
  const receipt = await blockchainService.raiseDisputeOnChain(id, reason.trim());
  return { txHash: receipt.transactionHash, reservationId: id, reason: reason.trim() };
}

async function resolveDispute(reservationId, refund) {
  if (typeof refund !== "boolean") throw new Error("refund must be a boolean");
  const id = Number(reservationId);
  if (isNaN(id)) throw new Error("Invalid reservation ID");
  const receipt = await blockchainService.resolveDisputeOnChain(id, refund);
  return { txHash: receipt.transactionHash, reservationId: id, outcome: refund ? "Refunded" : "Rejected" };
}

async function getDispute(reservationId) {
  const id = Number(reservationId);
  if (isNaN(id)) throw new Error("Invalid reservation ID");
  return blockchainService.getDisputeFromChain(id);
}

module.exports = { raiseDispute, resolveDispute, getDispute };
