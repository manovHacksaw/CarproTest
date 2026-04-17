const { ethers } = require("ethers");

class BlockchainTransformer {
  transformTransaction(tx, receipt) {
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: ethers.utils.formatEther(tx.value || 0),
      gasLimit: tx.gasLimit?.toString(),
      gasPrice: tx.gasPrice ? ethers.utils.formatUnits(tx.gasPrice, "gwei") : null,
      nonce: tx.nonce,
      blockNumber: tx.blockNumber,
      status: receipt?.status === 1 ? "success" : receipt?.status === 0 ? "failed" : "pending",
      gasUsed: receipt?.gasUsed?.toString(),
      confirmations: tx.confirmations,
    };
  }

  transformEvent(event) {
    return {
      type: event.event,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      args: Object.fromEntries(
        Object.entries(event.args || {}).filter(([k]) => isNaN(k))
      ),
      timestamp: new Date().toISOString(),
    };
  }

  transformNetworkStatus(network, blockNumber, gasPrice) {
    return {
      connected: true,
      networkName: network.name,
      chainId: network.chainId,
      blockNumber,
      gasPrice: ethers.utils.formatUnits(gasPrice, "gwei"),
    };
  }
}

module.exports = new BlockchainTransformer();
