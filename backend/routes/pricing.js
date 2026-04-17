const router = require("express").Router();
const pricingService = require("../services/pricingService");
const { successResponse, errorResponse } = require("../utils/helpers");

// GET /api/pricing/quote?carName=&pickUpDate=&dropOffDate=
router.get("/quote", (req, res) => {
  const { carName, pickUpDate, dropOffDate } = req.query;
  if (!carName || !pickUpDate || !dropOffDate)
    return errorResponse(res, "carName, pickUpDate, dropOffDate are required", 422);
  try {
    const quote = pricingService.getPriceQuote(carName, pickUpDate, dropOffDate);
    return successResponse(res, quote);
  } catch (err) {
    return errorResponse(res, err.message);
  }
});

// GET /api/pricing/all - all car prices
router.get("/all", (req, res) => {
  return successResponse(res, pricingService.getAllCarPrices());
});

module.exports = router;
