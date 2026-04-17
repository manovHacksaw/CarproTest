const { CAR_DATA } = require("../config/carData");
const { calculateRentalCost } = require("../utils/helpers");
const { ETH_TO_USD_RATE } = require("../config/config");

function getCarByName(name) {
  return CAR_DATA.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

function calculatePrice(carName, pickUpDate, dropOffDate) {
  const car = getCarByName(carName);
  if (!car) throw new Error(`Car not found: ${carName}`);
  return calculateRentalCost(car.pricePerDayEth, pickUpDate, dropOffDate);
}

function applyDiscount(totalEth, days) {
  let discount = 0;
  if (days >= 7) discount = 0.1;       // 10% weekly discount
  else if (days >= 3) discount = 0.05; // 5% 3-day discount
  const discountedEth = (parseFloat(totalEth) * (1 - discount)).toFixed(6);
  const discountedUsd = (parseFloat(discountedEth) * ETH_TO_USD_RATE).toFixed(2);
  return { discountedEth, discountedUsd, discountPercent: discount * 100 };
}

function getPriceQuote(carName, pickUpDate, dropOffDate) {
  const base = calculatePrice(carName, pickUpDate, dropOffDate);
  const discounted = applyDiscount(base.totalEth, base.days);
  return {
    carName,
    ...base,
    ...discounted,
    ethToUsdRate: ETH_TO_USD_RATE,
  };
}

function getAllCarPrices() {
  return CAR_DATA.map((car) => ({
    id: car.id,
    name: car.name,
    pricePerDayEth: car.pricePerDayEth,
    pricePerDayUsd: (parseFloat(car.pricePerDayEth) * ETH_TO_USD_RATE).toFixed(2),
    category: car.category,
  }));
}

module.exports = { calculatePrice, applyDiscount, getPriceQuote, getAllCarPrices, getCarByName };
