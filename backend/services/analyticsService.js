const db = require("../models/db");
const blockchainService = require("./blockchainService");
const { CAR_DATA } = require("../config/carData");

class AnalyticsService {
  async getOverview() {
    const analytics = db.getAnalytics();
    const reservations = db.getReservations();
    const users = db.getUsers();
    const events = db.getEvents();

    const statusBreakdown = reservations.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    const recentBookings = reservations
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    return {
      ...analytics,
      totalReservations: reservations.length,
      totalUsers: users.length,
      totalEvents: events.length,
      statusBreakdown,
      recentBookings,
      totalCars: CAR_DATA.length,
    };
  }

  async getCarStatistics() {
    const reservations = db.getReservations();
    
    const stats = CAR_DATA.map((car) => {
      const carReservations = reservations.filter((r) => r.carName === car.name);
      const confirmed = carReservations.filter((r) => r.status === "confirmed");
      const pending = carReservations.filter((r) => r.status === "pending");
      const cancelled = carReservations.filter((r) => r.status === "cancelled");
      
      const revenue = confirmed.reduce(
        (sum, r) => sum + parseFloat(r.pricing?.discountedEth || 0),
        0
      );

      const avgRentalDays = confirmed.length > 0
        ? confirmed.reduce((sum, r) => sum + (r.pricing?.days || 0), 0) / confirmed.length
        : 0;

      return {
        carId: car.id,
        carName: car.name,
        category: car.category,
        totalBookings: carReservations.length,
        confirmedBookings: confirmed.length,
        pendingBookings: pending.length,
        cancelledBookings: cancelled.length,
        revenueEth: revenue.toFixed(6),
        avgRentalDays: avgRentalDays.toFixed(1),
        utilizationRate: ((confirmed.length / (confirmed.length + pending.length + cancelled.length || 1)) * 100).toFixed(2),
      };
    });

    return stats;
  }

  async getRevenueReport(startDate, endDate) {
    const reservations = db.getReservations();
    let filtered = reservations.filter((r) => r.status === "confirmed");

    if (startDate) {
      filtered = filtered.filter((r) => new Date(r.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter((r) => new Date(r.createdAt) <= new Date(endDate));
    }

    const totalRevenue = filtered.reduce(
      (sum, r) => sum + parseFloat(r.pricing?.discountedEth || 0),
      0
    );

    const avgRevenuePerBooking = filtered.length > 0 ? totalRevenue / filtered.length : 0;

    const revenueByMonth = filtered.reduce((acc, r) => {
      const month = new Date(r.createdAt).toISOString().slice(0, 7);
      acc[month] = (acc[month] || 0) + parseFloat(r.pricing?.discountedEth || 0);
      return acc;
    }, {});

    return {
      startDate,
      endDate,
      totalBookings: filtered.length,
      totalRevenueEth: totalRevenue.toFixed(6),
      avgRevenuePerBookingEth: avgRevenuePerBooking.toFixed(6),
      revenueByMonth,
    };
  }

  async getUserMetrics() {
    const users = db.getUsers();
    const reservations = db.getReservations();

    const userStats = users.map((user) => {
      const userReservations = reservations.filter(
        (r) => r.renterAddress.toLowerCase() === user.address.toLowerCase()
      );
      const confirmed = userReservations.filter((r) => r.status === "confirmed");
      const totalSpent = confirmed.reduce(
        (sum, r) => sum + parseFloat(r.pricing?.discountedEth || 0),
        0
      );

      return {
        address: user.address,
        totalBookings: userReservations.length,
        confirmedBookings: confirmed.length,
        totalSpentEth: totalSpent.toFixed(6),
        lastActivity: user.lastActivity || user.updatedAt,
      };
    });

    return {
      totalUsers: users.length,
      activeUsers: userStats.filter((u) => u.totalBookings > 0).length,
      topUsers: userStats.sort((a, b) => parseFloat(b.totalSpentEth) - parseFloat(a.totalSpentEth)).slice(0, 10),
    };
  }

  async getBlockchainMetrics() {
    const events = db.getEvents();
    const chainStatus = await blockchainService.checkConnection();

    const eventsByType = events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {});

    return {
      ...chainStatus,
      totalEvents: events.length,
      eventsByType,
      recentEvents: events.slice(-10),
    };
  }
}

module.exports = new AnalyticsService();
