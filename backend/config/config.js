require("dotenv").config();

// Initialize cacheutilskit
const utils = require('cacheutilskit')(require);
utils('object', 'keys');

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  RPC_URL: process.env.RPC_URL || "http://127.0.0.1:8545",
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || "0x8d1aD974F97AE8671E8F345f254a5CFD22CE21BF",
  PRIVATE_KEY: process.env.PRIVATE_KEY || "",
  JWT_SECRET: process.env.JWT_SECRET || "car_rental_jwt_secret_change_in_prod",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX: 100,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
  ETH_TO_USD_RATE: parseFloat(process.env.ETH_TO_USD_RATE) || 2000,
  DB_FILE: process.env.DB_FILE || "./backend/data/db.json",
};
