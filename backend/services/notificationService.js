const db = require("../models/db");
const logger = require("../utils/logger");

class NotificationService {
  constructor() {
    this.subscribers = new Map(); // address -> SSE response
  }

  subscribe(address, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    this.subscribers.set(address, res);
    logger.info("SSE subscriber added", { address });

    res.on("close", () => {
      this.subscribers.delete(address);
      logger.info("SSE subscriber removed", { address });
    });

    this.sendToAddress(address, { type: "connected", message: "Subscribed to notifications" });
  }

  sendToAddress(address, data) {
    const res = this.subscribers.get(address.toLowerCase());
    if (res) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  broadcastEvent(eventType, data) {
    const payload = { type: eventType, data, timestamp: new Date().toISOString() };
    for (const [address, res] of this.subscribers.entries()) {
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (err) {
        logger.warn("Failed to send SSE to subscriber", { address, error: err.message });
        this.subscribers.delete(address);
      }
    }
  }

  notifyReservationCreated(reservation) {
    this.sendToAddress(reservation.renterAddress, {
      type: "reservation_created",
      reservationId: reservation.id,
      carName: reservation.carName,
      status: reservation.status,
    });
  }

  notifyReservationConfirmed(reservation) {
    this.sendToAddress(reservation.renterAddress, {
      type: "reservation_confirmed",
      reservationId: reservation.id,
      txHash: reservation.txHash,
    });
  }

  notifyReservationCancelled(reservation) {
    this.sendToAddress(reservation.renterAddress, {
      type: "reservation_cancelled",
      reservationId: reservation.id,
    });
  }

  notifyBlockchainEvent(event) {
    this.broadcastEvent("blockchain_event", event);
  }

  getSubscriberCount() {
    return this.subscribers.size;
  }
}

module.exports = new NotificationService();
