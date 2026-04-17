const { ethers } = require("ethers");
const blockchainService = require("./blockchainService");
const logger = console;

class WalletService {
  async getBalance(address) {
    try {
      const provider = blockchainService.getProvider();
      const balance = await provider.getBalance(address);
      return {
        address,
        balanceWei: balance.toString(),
        balanceEth: ethers.utils.formatEther(balance),
      };
    } catch (err) {
      logger.error("Get balance failed", { address, error: err.message });
      throw new Error(`Failed to get balance: ${err.message}`);
    }
  }

  async getTransactionCount(address) {
    try {
      const provider = blockchainService.getProvider();
      const count = await provider.getTransactionCount(address);
      return { address, transactionCount: count };
    } catch (err) {
      logger.error("Get transaction count failed", { address, error: err.message });
      throw new Error(`Failed to get transaction count: ${err.message}`);
    }
  }

  async getTransactionHistory(address, limit = 10) {
    try {
      const provider = blockchainService.getProvider();
      const currentBlock = await provider.getBlockNumber();
      const transactions = [];

      for (let i = currentBlock; i > Math.max(0, currentBlock - 1000) && transactions.length < limit; i--) {
        const block = await provider.getBlockWithTransactions(i);
        const userTxs = block.transactions.filter(
          (tx) => tx.from.toLowerCase() === address.toLowerCase() || 
                  tx.to?.toLowerCase() === address.toLowerCase()
        );
        transactions.push(...userTxs);
      }

      return {
        address,
        transactions: transactions.slice(0, limit).map((tx) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: ethers.utils.formatEther(tx.value),
          blockNumber: tx.blockNumber,
        })),
      };
    } catch (err) {
      logger.error("Get transaction history failed", { address, error: err.message });
      throw new Error(`Failed to get transaction history: ${err.message}`);
    }
  }

  validateAddress(address) {
    try {
      return ethers.utils.isAddress(address);
    } catch {
      return false;
    }
  }

  async estimateTransferGas(from, to, amountEth) {
    try {
      const provider = blockchainService.getProvider();
      const gasEstimate = await provider.estimateGas({
        from,
        to,
        value: ethers.utils.parseEther(amountEth),
      });

      const gasPrice = await provider.getGasPrice();
      const gasCost = gasEstimate.mul(gasPrice);

      return {
        gasEstimate: gasEstimate.toString(),
        gasPrice: ethers.utils.formatUnits(gasPrice, "gwei"),
        gasCostEth: ethers.utils.formatEther(gasCost),
      };
    } catch (err) {
      logger.error("Estimate transfer gas failed", { error: err.message });
      throw new Error(`Failed to estimate gas: ${err.message}`);
    }
  }
}

module.exports = new WalletService();
