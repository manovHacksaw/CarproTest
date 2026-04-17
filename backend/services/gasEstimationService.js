const blockchainService = require("./blockchainService");
const { ethers } = require("ethers");
const logger = console;

class GasEstimationService {
  async estimateOperation(operation, params) {
    const contract = blockchainService.getContract();
    let gasEstimate;

    try {
      switch (operation) {
        case "bookCar":
          gasEstimate = await contract.estimateGas.bookCar(
            params.renterAddress,
            params.carType,
            params.pickUpDate,
            params.dropOffDate
          );
          break;

        case "confirmReservation":
          gasEstimate = await contract.estimateGas.confirmReservation(params.reservationId);
          break;

        case "cancelReservation":
          gasEstimate = await contract.estimateGas.cancelReservation(params.reservationId);
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      const gasPrice = await blockchainService.getProvider().getGasPrice();
      const gasCostWei = gasEstimate.mul(gasPrice);
      const gasCostEth = ethers.utils.formatEther(gasCostWei);

      return {
        operation,
        gasEstimate: gasEstimate.toString(),
        gasPrice: ethers.utils.formatUnits(gasPrice, "gwei"),
        gasCostEth,
        gasCostWei: gasCostWei.toString(),
      };
    } catch (err) {
      logger.error("Gas estimation failed", { operation, error: err.message });
      throw new Error(`Gas estimation failed: ${err.message}`);
    }
  }

  async getCurrentGasPrice() {
    const gasPrice = await blockchainService.getProvider().getGasPrice();
    return {
      wei: gasPrice.toString(),
      gwei: ethers.utils.formatUnits(gasPrice, "gwei"),
      eth: ethers.utils.formatEther(gasPrice),
    };
  }

  async estimateBatchOperations(operations) {
    const estimates = await Promise.all(
      operations.map((op) => this.estimateOperation(op.operation, op.params))
    );

    const totalGas = estimates.reduce(
      (sum, est) => sum + parseFloat(est.gasCostEth),
      0
    );

    return {
      operations: estimates,
      totalGasCostEth: totalGas.toFixed(6),
    };
  }
}

module.exports = new GasEstimationService();
