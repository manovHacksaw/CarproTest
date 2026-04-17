const { errorResponse, isValidEthAddress } = require("../utils/helpers");
const { CAR_DATA, LOCATIONS } = require("../config/carData");

const carNames = CAR_DATA.map((c) => c.name.toLowerCase());
const locationNames = LOCATIONS.map((l) => l.toLowerCase());

function validateBooking(req, res, next) {
  const { renterAddress, carName, pickUpDate, dropOffDate, pickUpLocation, dropOffLocation } = req.body;
  const errors = [];

  if (!renterAddress || !isValidEthAddress(renterAddress))
    errors.push("Valid Ethereum address required (renterAddress)");

  if (!carName || !carNames.includes(carName.toLowerCase()))
    errors.push(`Invalid carName. Valid options: ${CAR_DATA.map((c) => c.name).join(", ")}`);

  if (!pickUpDate) errors.push("pickUpDate is required");
  if (!dropOffDate) errors.push("dropOffDate is required");

  if (pickUpLocation && !locationNames.includes(pickUpLocation.toLowerCase()))
    errors.push(`Invalid pickUpLocation. Valid: ${LOCATIONS.join(", ")}`);

  if (dropOffLocation && !locationNames.includes(dropOffLocation.toLowerCase()))
    errors.push(`Invalid dropOffLocation. Valid: ${LOCATIONS.join(", ")}`);

  if (errors.length > 0) return errorResponse(res, "Validation failed", 422, errors);
  next();
}

function validateConfirm(req, res, next) {
  const { txHash } = req.body;
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash))
    return errorResponse(res, "Valid txHash required", 422);
  next();
}

function validateWalletAuth(req, res, next) {
  const { address, signature, message } = req.body;
  if (!address || !isValidEthAddress(address))
    return errorResponse(res, "Valid Ethereum address required", 422);
  if (!signature) return errorResponse(res, "Signature required", 422);
  if (!message) return errorResponse(res, "Message required", 422);
  next();
}

module.exports = { validateBooking, validateConfirm, validateWalletAuth };
