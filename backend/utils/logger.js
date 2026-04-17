const fs = require("fs");
const path = require("path");

const LOG_FILE = path.resolve(__dirname, "../logs/app.log");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LEVELS[process.env.LOG_LEVEL || "info"];

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

function writeToFile(line) {
  try {
    fs.appendFileSync(LOG_FILE, line + "\n");
  } catch {
    // silently fail if log file not writable
  }
}

function log(level, message, meta = {}) {
  if (LEVELS[level] > CURRENT_LEVEL) return;
  const line = formatMessage(level, message, meta);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
  writeToFile(line);
}

const logger = {
  error: (msg, meta) => log("error", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  info: (msg, meta) => log("info", msg, meta),
  debug: (msg, meta) => log("debug", msg, meta),
};

module.exports = logger;
