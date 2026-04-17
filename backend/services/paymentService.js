const { ethers } = require("ethers");
const { v4: uuidv4 } = require("uuid");
const blockchainService = require("./blockchainService");
const db = require("../models/db");
const logger = require("../utils/logger");

class PaymentService {
  async verifyPayment(txHash, expectedAmountEth, renterAddress) {
    try {
      const provider = blockchainService.getProvider();
      const tx = await provider.getTransaction(txHash);

      if (!tx) throw new Error("Transaction not found on chain");

      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) throw new Error("Transaction not yet mined");
      if (receipt.status !== 1) throw new Error("Transaction failed on chain");

      const actualAmountEth = ethers.utils.formatEther(tx.value);
      const expectedWei = ethers.utils.parseEther(expectedAmountEth);
      const actualWei = tx.value;

      const isAmountCorrect = actualWei.gte(expectedWei);
      const isFromCorrectAddress = tx.from.toLowerCase() === renterAddress.toLowerCase();

      return {
        valid: isAmountCorrect && isFromCorrectAddress,
        txHash,
        from: tx.from,
        to: tx.to,
        amountEth: actualAmountEth,
        expectedAmountEth,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        isAmountCorrect,
        isFromCorrectAddress,
      };
    } catch (err) {
      logger.error("Payment verification failed", { txHash, error: err.message });
      throw new Error(`Payment verification failed: ${err.message}`);
    }
  }

  async recordPayment(reservationId, txHash, amountEth, renterAddress) {
    const payment = {
      id: uuidv4(),
      reservationId,
      txHash,
      amountEth,
      renterAddress,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };

    db.savePayment(payment);
    logger.info("Payment recorded", { id: payment.id, txHash, amountEth });
    return payment;
  }

  async getPaymentsByAddress(address) {
    const payments = db.getPayments();
    return payments.filter(
      (p) => p.renterAddress.toLowerCase() === address.toLowerCase()
    );
  }

  async getPaymentByReservation(reservationId) {
    const payments = db.getPayments();
    return payments.find((p) => p.reservationId === reservationId) || null;
  }

  async getTotalRevenue() {
    const payments = db.getPayments();
    const total = payments
      .filter((p) => p.status === "confirmed")
      .reduce((sum, p) => sum + parseFloat(p.amountEth || 0), 0);
    return total.toFixed(6);
  }
}

module.exports = new PaymentService();
