/**
 * Simple file-based JSON database
 * Stores users, reservations, payments, analytics
 */
const fs = require("fs");
const path = require("path");
const { DB_FILE } = require("../config/config");

const dbPath = path.resolve(DB_FILE);
const dbDir = path.dirname(dbPath);

function ensureDb() {
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    const initial = {
      users: [],
      reservations: [],
      payments: [],
      analytics: { totalBookings: 0, totalRevenue: "0", carStats: {} },
      events: [],
      transactions: [],
    };
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2));
    console.log("Database initialized", { path: dbPath });
  }
}

function read() {
  ensureDb();
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
}

function write(data) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// --- Users ---
function getUsers() { return read().users; }
function getUserByAddress(address) {
  return read().users.find((u) => u.address.toLowerCase() === address.toLowerCase());
}
function upsertUser(address, info = {}) {
  const db = read();
  const idx = db.users.findIndex((u) => u.address.toLowerCase() === address.toLowerCase());
  if (idx >= 0) {
    db.users[idx] = { ...db.users[idx], ...info, updatedAt: new Date().toISOString() };
  } else {
    db.users.push({
      address,
      ...info,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  write(db);
  return getUserByAddress(address);
}

// --- Reservations ---
function getReservations() { return read().reservations; }
function getReservationById(id) { return read().reservations.find((r) => r.id === id); }
function getReservationsByAddress(address) {
  return read().reservations.filter(
    (r) => r.renterAddress.toLowerCase() === address.toLowerCase()
  );
}
function saveReservation(reservation) {
  const db = read();
  const idx = db.reservations.findIndex((r) => r.id === reservation.id);
  if (idx >= 0) db.reservations[idx] = reservation;
  else db.reservations.push(reservation);
  write(db);
  return reservation;
}

// --- Payments ---
function getPayments() { return read().payments; }
function savePayment(payment) {
  const db = read();
  db.payments.push(payment);
  write(db);
  return payment;
}

// --- Analytics ---
function getAnalytics() { return read().analytics; }
function updateAnalytics(carName, revenueEth) {
  const db = read();
  db.analytics.totalBookings += 1;
  db.analytics.totalRevenue = (
    parseFloat(db.analytics.totalRevenue) + parseFloat(revenueEth)
  ).toFixed(6);
  if (!db.analytics.carStats[carName]) {
    db.analytics.carStats[carName] = { bookings: 0, revenue: "0" };
  }
  db.analytics.carStats[carName].bookings += 1;
  db.analytics.carStats[carName].revenue = (
    parseFloat(db.analytics.carStats[carName].revenue) + parseFloat(revenueEth)
  ).toFixed(6);
  write(db);
}

// --- Blockchain Events ---
function saveEvent(event) {
  const db = read();
  db.events.push({ ...event, savedAt: new Date().toISOString() });
  write(db);
}
function getEvents() { return read().events; }

// --- Transactions ---
function getTransactions() { return read().transactions || []; }
function getTransactionByHash(txHash) {
  return (read().transactions || []).find((t) => t.txHash === txHash);
}
function saveTransaction(transaction) {
  const db = read();
  if (!db.transactions) db.transactions = [];
  const idx = db.transactions.findIndex((t) => t.txHash === transaction.txHash);
  if (idx >= 0) db.transactions[idx] = transaction;
  else db.transactions.push({ ...transaction, savedAt: new Date().toISOString() });
  write(db);
  return transaction;
}

module.exports = {
  getUsers, getUserByAddress, upsertUser,
  getReservations, getReservationById, getReservationsByAddress, saveReservation,
  getPayments, savePayment,
  getAnalytics, updateAnalytics,
  saveEvent, getEvents,
  getTransactions, getTransactionByHash, saveTransaction,
};
