const { isValidEthAddress } = require("../utils/helpers");

class BlockchainValidator {
  validateAddress(address) {
    if (!address || !isValidEthAddress(address)) {
      return { valid: false, error: "Invalid Ethereum address" };
    }
    return { valid: true };
  }

  validateTxHash(hash) {
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { valid: false, error: "Invalid transaction hash" };
    }
    return { valid: true };
  }

  validateGasEstimateRequest(body) {
    const errors = [];
    const { operation, params } = body;

    const validOps = ["bookCar", "confirmReservation", "cancelReservation"];
    if (!operation || !validOps.includes(operation))
      errors.push(`Invalid operation. Valid: ${validOps.join(", ")}`);

    if (!params || typeof params !== "object")
      errors.push("params object is required");

    return { valid: errors.length === 0, errors };
  }

  validateBlockRange(fromBlock, toBlock) {
    const errors = [];

    if (fromBlock !== undefined && isNaN(parseInt(fromBlock)))
      errors.push("fromBlock must be a number");

    if (toBlock !== undefined && toBlock !== "latest" && isNaN(parseInt(toBlock)))
      errors.push("toBlock must be a number or 'latest'");

    return { valid: errors.length === 0, errors };
  }
}

module.exports = new BlockchainValidator();
