const { isValidEthAddress } = require("../utils/helpers");

class UserValidator {
  validateWalletAuth(data) {
    const errors = [];
    const { address, signature, message } = data;

    if (!address || !isValidEthAddress(address))
      errors.push("Valid Ethereum address required");

    if (!signature || typeof signature !== "string" || signature.length < 10)
      errors.push("Valid signature required");

    if (!message || typeof message !== "string" || message.length < 1)
      errors.push("Message required");

    return { valid: errors.length === 0, errors };
  }

  validateAddress(address) {
    if (!address || !isValidEthAddress(address)) {
      return { valid: false, error: "Invalid Ethereum address" };
    }
    return { valid: true };
  }
}

module.exports = new UserValidator();
