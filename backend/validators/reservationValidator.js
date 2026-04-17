const { isValidEthAddress, validateDateRange } = require("../utils/helpers");
const { CAR_DATA, LOCATIONS } = require("../config/carData");

const carNames = CAR_DATA.map((c) => c.name.toLowerCase());
const locationNames = LOCATIONS.map((l) => l.toLowerCase());

class ReservationValidator {
  validateCreate(data) {
    const errors = [];
    const { renterAddress, carName, pickUpDate, dropOffDate, pickUpLocation, dropOffLocation } = data;

    if (!renterAddress || !isValidEthAddress(renterAddress))
      errors.push("Valid Ethereum address required (renterAddress)");

    if (!carName || !carNames.includes(carName.toLowerCase()))
      errors.push(`Invalid carName. Valid: ${CAR_DATA.map((c) => c.name).join(", ")}`);

    if (!pickUpDate) errors.push("pickUpDate is required");
    if (!dropOffDate) errors.push("dropOffDate is required");

    if (pickUpDate && dropOffDate) {
      const dateCheck = validateDateRange(pickUpDate, dropOffDate);
      if (!dateCheck.valid) errors.push(dateCheck.message);
    }

    if (pickUpLocation && !locationNames.includes(pickUpLocation.toLowerCase()))
      errors.push(`Invalid pickUpLocation. Valid: ${LOCATIONS.join(", ")}`);

    if (dropOffLocation && !locationNames.includes(dropOffLocation.toLowerCase()))
      errors.push(`Invalid dropOffLocation. Valid: ${LOCATIONS.join(", ")}`);

    return { valid: errors.length === 0, errors };
  }

  validateConfirm(data) {
    const errors = [];
    const { txHash } = data;

    if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash))
      errors.push("Valid txHash required (0x + 64 hex chars)");

    return { valid: errors.length === 0, errors };
  }

  validateCancel(data) {
    const errors = [];
    const { renterAddress } = data;

    if (!renterAddress || !isValidEthAddress(renterAddress))
      errors.push("Valid Ethereum address required (renterAddress)");

    return { valid: errors.length === 0, errors };
  }
}

module.exports = new ReservationValidator();
