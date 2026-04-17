const { ETH_TO_USD_RATE } = require("../config/config");

function calculateRentalCost(pricePerDayEth, pickUpDate, dropOffDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.ceil((new Date(dropOffDate) - new Date(pickUpDate)) / msPerDay);
  if (days <= 0) throw new Error("Drop-off must be after pick-up");
  const totalEth = (parseFloat(pricePerDayEth) * days).toFixed(6);
  const totalUsd = (parseFloat(totalEth) * ETH_TO_USD_RATE).toFixed(2);
  return { days, totalEth, totalUsd, pricePerDayEth };
}

function toUnixTimestamp(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

function isValidEthAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function validateDateRange(pickUpDate, dropOffDate) {
  const now = new Date();
  const pick = new Date(pickUpDate);
  const drop = new Date(dropOffDate);
  if (isNaN(pick.getTime()) || isNaN(drop.getTime()))
    return { valid: false, message: "Invalid date format" };
  if (pick < now)
    return { valid: false, message: "Pick-up date must be in the future" };
  if (drop <= pick)
    return { valid: false, message: "Drop-off must be after pick-up" };
  return { valid: true };
}

function paginate(array, page = 1, limit = 10) {
  const start = (page - 1) * limit;
  const data = array.slice(start, start + limit);
  return {
    data,
    pagination: {
      total: array.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(array.length / limit),
    },
  };
}

function successResponse(res, data, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function errorResponse(res, message = "Error", statusCode = 400, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
}

module.exports = {
  calculateRentalCost,
  toUnixTimestamp,
  isValidEthAddress,
  validateDateRange,
  paginate,
  successResponse,
  errorResponse,
};
