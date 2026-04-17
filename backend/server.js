const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { PORT, CORS_ORIGIN, NODE_ENV } = require("./config/config");
const logger = require("./utils/logger");

// ── Core Services ─────────────────────────────────────────────────────────────
const blockchainService = require("./services/blockchainService");
const transactionMonitorService = require("./services/transactionMonitorService");
const notificationService = require("./services/notificationService");
const cacheService = require("./services/cacheService");

// ── Middleware ────────────────────────────────────────────────────────────────
const { globalLimiter } = require("./middleware/rateLimiter");
const { errorHandler, notFound } = require("./middleware/errorHandler");

// ── Routes (original) ─────────────────────────────────────────────────────────
const carsRouter = require("./routes/cars");
const reservationsRouter = require("./routes/reservations");
const blockchainRouter = require("./routes/blockchain");
const usersRouter = require("./routes/users");
const analyticsRouter = require("./routes/analytics");
const pricingRouter = require("./routes/pricing");

// ── Routes (new) ──────────────────────────────────────────────────────────────
const contractRouter = require("./routes/contract");
const paymentsRouter = require("./routes/payments");
const gasRouter = require("./routes/gas");
const walletRouter = require("./routes/wallet");
const eventsRouter = require("./routes/events");
const notificationsRouter = require("./routes/notifications");
const disputesRouter = require("./routes/disputes");

const app = express();

// ── Security & Parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));
app.use(globalLimiter);

// ── Health & Status ───────────────────────────────────────────────────────────
app.get("/health", async (req, res) => {
  const chain = await blockchainService.checkConnection();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    blockchain: chain,
    cache: cacheService.getStats(),
    notifications: { activeSubscribers: notificationService.getSubscriberCount() },
    pendingTransactions: transactionMonitorService.getPendingTransactions().length,
  });
});

app.get("/api/status", async (req, res) => {
  const contractInfo = await blockchainService.getContractInfo().catch(() => null);
  res.json({
    server: { uptime: process.uptime(), env: NODE_ENV, port: PORT },
    blockchain: contractInfo,
    cache: cacheService.getStats(),
  });
});

// ── Original API Routes ───────────────────────────────────────────────────────
app.use("/api/cars", carsRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/blockchain", blockchainRouter);
app.use("/api/users", usersRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/pricing", pricingRouter);

// ── New Smart Contract & Extended Routes ──────────────────────────────────────
app.use("/api/contract", contractRouter);       // direct contract interactions
app.use("/api/payments", paymentsRouter);       // payment verification & records
app.use("/api/gas", gasRouter);                 // gas estimation
app.use("/api/wallet", walletRouter);           // wallet balance, nonce, history
app.use("/api/events", eventsRouter);           // blockchain event log
app.use("/api/notifications", notificationsRouter); // SSE real-time notifications
app.use("/api/disputes", disputesRouter);           // dispute resolution

// ── 404 & Error Handling ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  logger.info("Starting Car Rental Backend...");

  // Bootstrap: compile + deploy contract + start event listeners
  const deployInfo = await blockchainService.bootstrap().catch((err) => {
    logger.error("FATAL: Bootstrap failed. " + err.message);
    logger.error("Run: npx hardhat node");
    process.exit(1);
  });

  // Start transaction monitoring (polls every 15s)
  transactionMonitorService.startMonitoring(15000);

  const chainStatus = await blockchainService.checkConnection();

  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`Environment: ${NODE_ENV}`);
    logger.info(`Blockchain: ${chainStatus.network} (chainId: ${chainStatus.chainId})`);
    logger.info(`Contract: ${deployInfo?.contractAddress}`);
    logger.info("─── API Routes ───────────────────────────────────────");
    logger.info("  GET    /health");
    logger.info("  GET    /api/status");
    logger.info("  ── Cars ──");
    logger.info("  GET    /api/cars");
    logger.info("  GET    /api/cars/:id/quote");
    logger.info("  GET    /api/cars/prices");
    logger.info("  ── Reservations ──");
    logger.info("  POST   /api/reservations");
    logger.info("  PATCH  /api/reservations/:id/confirm");
    logger.info("  DELETE /api/reservations/:id");
    logger.info("  GET    /api/reservations/chain");
    logger.info("  ── Contract (direct chain calls) ──");
    logger.info("  GET    /api/contract/info");
    logger.info("  GET    /api/contract/count");
    logger.info("  GET    /api/contract/reservation/:id");
    logger.info("  POST   /api/contract/book");
    logger.info("  POST   /api/contract/confirm/:id");
    logger.info("  POST   /api/contract/cancel/:id");
    logger.info("  ── Blockchain ──");
    logger.info("  GET    /api/blockchain/status");
    logger.info("  GET    /api/blockchain/balance/:address");
    logger.info("  GET    /api/blockchain/tx/:hash");
    logger.info("  GET    /api/blockchain/events");
    logger.info("  ── Wallet ──");
    logger.info("  GET    /api/wallet/:address/balance");
    logger.info("  GET    /api/wallet/:address/nonce");
    logger.info("  GET    /api/wallet/:address/history");
    logger.info("  POST   /api/wallet/validate");
    logger.info("  POST   /api/wallet/estimate-transfer");
    logger.info("  ── Gas ──");
    logger.info("  GET    /api/gas/price");
    logger.info("  POST   /api/gas/estimate");
    logger.info("  POST   /api/gas/estimate/batch");
    logger.info("  ── Payments ──");
    logger.info("  POST   /api/payments/verify");
    logger.info("  GET    /api/payments/revenue");
    logger.info("  GET    /api/payments/reservation/:id");
    logger.info("  GET    /api/payments/fee");
    logger.info("  GET    /api/payments/contract-balance");
    logger.info("  GET    /api/payments/chain/:reservationId");
    logger.info("  POST   /api/payments/fee");
    logger.info("  POST   /api/payments/withdraw");
    logger.info("  ── Disputes ──");
    logger.info("  POST   /api/disputes/:reservationId/raise");
    logger.info("  POST   /api/disputes/:reservationId/resolve");
    logger.info("  GET    /api/disputes/:reservationId");
    logger.info("  ── Events ──");
    logger.info("  GET    /api/events");
    logger.info("  GET    /api/events/latest");
    logger.info("  GET    /api/events/types");
    logger.info("  GET    /api/events/query");
    logger.info("  ── Notifications (SSE) ──");
    logger.info("  GET    /api/notifications/subscribe/:address");
    logger.info("  GET    /api/notifications/stats");
    logger.info("  ── Users ──");
    logger.info("  POST   /api/users/auth");
    logger.info("  GET    /api/users/:address");
    logger.info("  ── Analytics ──");
    logger.info("  GET    /api/analytics");
    logger.info("  GET    /api/analytics/cars");
    logger.info("  ── Pricing ──");
    logger.info("  GET    /api/pricing/quote");
    logger.info("  GET    /api/pricing/all");
    logger.info("─────────────────────────────────────────────────────");
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  transactionMonitorService.stopMonitoring();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down...");
  transactionMonitorService.stopMonitoring();
  process.exit(0);
});

start();
