const router = require("express").Router();
const notificationService = require("../services/notificationService");
const { successResponse } = require("../utils/helpers");

// GET /api/notifications/subscribe/:address - SSE stream for real-time events
router.get("/subscribe/:address", (req, res) => {
  const { address } = req.params;
  notificationService.subscribe(address, res);
});

// GET /api/notifications/stats - subscriber stats
router.get("/stats", (req, res) => {
  return successResponse(res, {
    activeSubscribers: notificationService.getSubscriberCount(),
  });
});

module.exports = router;
