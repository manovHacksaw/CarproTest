const router = require("express").Router();
const { CAR_DATA, LOCATIONS } = require("../config/carData");
const pricingService = require("../services/pricingService");
const { successResponse, errorResponse, paginate } = require("../utils/helpers");

// GET /api/cars - list all cars with optional filters
router.get("/", (req, res) => {
  const { category, transmission, fuel, available, page = 1, limit = 10 } = req.query;
  let cars = [...CAR_DATA];

  if (category) cars = cars.filter((c) => c.category === category);
  if (transmission) cars = cars.filter((c) => c.transmission.toLowerCase() === transmission.toLowerCase());
  if (fuel) cars = cars.filter((c) => c.fuel.toLowerCase() === fuel.toLowerCase());
  if (available !== undefined) cars = cars.filter((c) => c.available === (available === "true"));

  const result = paginate(cars, page, limit);
  return successResponse(res, result);
});

// GET /api/cars/prices - all car prices in ETH and USD
router.get("/prices", (req, res) => {
  return successResponse(res, pricingService.getAllCarPrices());
});

// GET /api/cars/locations - available locations
router.get("/locations", (req, res) => {
  return successResponse(res, LOCATIONS);
});

// GET /api/cars/:id - single car details
router.get("/:id", (req, res) => {
  const car = CAR_DATA.find((c) => c.id === parseInt(req.params.id));
  if (!car) return errorResponse(res, "Car not found", 404);
  return successResponse(res, car);
});

// GET /api/cars/:id/quote?pickUpDate=&dropOffDate= - price quote
router.get("/:id/quote", (req, res) => {
  const car = CAR_DATA.find((c) => c.id === parseInt(req.params.id));
  if (!car) return errorResponse(res, "Car not found", 404);

  const { pickUpDate, dropOffDate } = req.query;
  if (!pickUpDate || !dropOffDate)
    return errorResponse(res, "pickUpDate and dropOffDate are required", 422);

  try {
    const quote = pricingService.getPriceQuote(car.name, pickUpDate, dropOffDate);
    return successResponse(res, quote);
  } catch (err) {
    return errorResponse(res, err.message);
  }
});

module.exports = router;
