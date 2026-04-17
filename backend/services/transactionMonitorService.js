const blockchainService = require("./blockchainService");
const db = require("../models/db");
const logger = console;

class TransactionMonitorService {
  constructor() {
    this.pendingTransactions = new Map();
    this.monitoringInterval = null;
  }

  startMonitoring(intervalMs = 15000) {
    if (this.monitoringInterval) {
      logger.warn("Transaction monitoring already started");
      return;
    }

    logger.info("Starting transaction monitoring", { intervalMs });
    this.monitoringInterval = setInterval(() => {
      this.checkPendingTransactions();
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info("Transaction monitoring stopped");
    }
  }

  trackTransaction(txHash, metadata = {}) {
    this.pendingTransactions.set(txHash, {
      txHash,
      status: "pending",
      addedAt: new Date().toISOString(),
      metadata,
    });
    logger.info("Tracking transaction", { txHash, metadata });
  }

  async checkPendingTransactions() {
    const provider = blockchainService.getProvider();

    for (const [txHash, txData] of this.pendingTransactions.entries()) {
      try {
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (receipt) {
          const status = receipt.status === 1 ? "confirmed" : "failed";
          
          logger.info("Transaction status updated", {
            txHash,
            status,
            blockNumber: receipt.blockNumber,
          });

          this.pendingTransactions.delete(txHash);

          db.saveTransaction({
            txHash,
            status,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
            metadata: txData.metadata,
            confirmedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        logger.error("Error checking transaction", { txHash, error: err.message });
      }
    }
  }

  getPendingTransactions() {
    return Array.from(this.pendingTransactions.values());
  }

  getTransactionStatus(txHash) {
    return this.pendingTransactions.get(txHash) || null;
  }
}

module.exports = new TransactionMonitorService();
