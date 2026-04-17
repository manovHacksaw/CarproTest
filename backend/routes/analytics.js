const router = require("express").Router();
const db = require("../models/db");
const { CAR_DATA } = require("../config/carData");
const { successResponse } = require("../utils/helpers");

// GET /api/analytics - overall stats
router.get("/", (req, res) => {
  const analytics = db.getAnalytics();
  const reservations = db.getReservations();

  const statusBreakdown = reservations.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const recentBookings = reservations
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map((r) => ({ id: r.id, carName: r.carName, status: r.status, createdAt: r.createdAt }));

  return successResponse(res, {
    ...analytics,
    totalReservations: reservations.length,
    statusBreakdown,
    recentBookings,
    totalCars: CAR_DATA.length,
  });
});

// GET /api/analytics/cars - per-car stats
router.get("/cars", (req, res) => {
  const reservations = db.getReservations();
  const stats = CAR_DATA.map((car) => {
    const carReservations = reservations.filter((r) => r.carName === car.name);
    const confirmed = carReservations.filter((r) => r.status === "confirmed");
    const revenue = confirmed.reduce(
      (sum, r) => sum + parseFloat(r.pricing?.discountedEth || 0), 0
    );
    return {
      carId: car.id,
      carName: car.name,
      category: car.category,
      totalBookings: carReservations.length,
      confirmedBookings: confirmed.length,
      revenueEth: revenue.toFixed(6),
    };
  });
  return successResponse(res, stats);
});

// GET /api/analytics/events - blockchain event log
router.get("/events", (req, res) => {
  const events = db.getEvents();
  const breakdown = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});
  return successResponse(res, { total: events.length, breakdown, events: events.slice(-20) });
});

module.exports = router;
