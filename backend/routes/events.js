const router = require("express").Router();
const contractEventService = require("../services/contractEventService");
const db = require("../models/db");
const { successResponse, errorResponse, paginate } = require("../utils/helpers");

// GET /api/events - all saved blockchain events with optional filters
router.get("/", (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;
  let events = db.getEvents();

  if (type) events = events.filter((e) => e.type === type);

  events.sort((a, b) => (b.blockNumber || 0) - (a.blockNumber || 0));
  return successResponse(res, paginate(events, page, limit));
});

// GET /api/events/types - distinct event types
router.get("/types", (req, res) => {
  const events = db.getEvents();
  const types = [...new Set(events.map((e) => e.type))];
  return successResponse(res, { types });
});

// GET /api/events/query - query events with block range
router.get("/query", async (req, res) => {
  try {
    const { eventType, fromBlock, toBlock } = req.query;
    const events = await contractEventService.queryEvents(eventType, fromBlock, toBlock);
    return successResponse(res, { count: events.length, events });
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

// GET /api/events/latest - most recent N events
router.get("/latest", (req, res) => {
  const { limit = 10 } = req.query;
  const events = db.getEvents()
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, parseInt(limit));
  return successResponse(res, events);
});

module.exports = router;
