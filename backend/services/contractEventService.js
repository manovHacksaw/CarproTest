const blockchainService = require("./blockchainService");
const db = require("../models/db");
const logger = console;

class ContractEventService {
  constructor() {
    this.eventHandlers = {
      CarBooked: this.handleCarBooked.bind(this),
      ReservationConfirmed: this.handleReservationConfirmed.bind(this),
      ReservationCanceled: this.handleReservationCanceled.bind(this),
      BackendAuthorized: this.handleBackendAuthorized.bind(this),
    };
  }

  async handleCarBooked(event) {
    logger.info("CarBooked event detected", {
      renter: event.args.renter,
      carType: event.args.carType,
      blockNumber: event.blockNumber,
    });

    db.saveEvent({
      type: "CarBooked",
      renter: event.args.renter,
      carType: event.args.carType,
      pickUpDate: event.args.pickUpDate.toString(),
      dropOffDate: event.args.dropOffDate.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toISOString(),
    });
  }

  async handleReservationConfirmed(event) {
    logger.info("ReservationConfirmed event", {
      reservationId: event.args.reservationId.toString(),
      blockNumber: event.blockNumber,
    });

    db.saveEvent({
      type: "ReservationConfirmed",
      reservationId: event.args.reservationId.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toISOString(),
    });
  }

  async handleReservationCanceled(event) {
    logger.info("ReservationCanceled event", {
      reservationId: event.args.reservationId.toString(),
      blockNumber: event.blockNumber,
    });

    db.saveEvent({
      type: "ReservationCanceled",
      reservationId: event.args.reservationId.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toISOString(),
    });
  }

  async handleBackendAuthorized(event) {
    logger.info("BackendAuthorized event", {
      backend: event.args.backend,
      blockNumber: event.blockNumber,
    });

    db.saveEvent({
      type: "BackendAuthorized",
      backend: event.args.backend,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toISOString(),
    });
  }

  async queryEvents(eventType, fromBlock = 0, toBlock = "latest") {
    const events = db.getEvents();
    let filtered = events;

    if (eventType) {
      filtered = filtered.filter((e) => e.type === eventType);
    }

    if (fromBlock !== 0) {
      filtered = filtered.filter((e) => e.blockNumber >= parseInt(fromBlock));
    }

    return filtered;
  }

  processEvent(event) {
    const handler = this.eventHandlers[event.event];
    if (handler) {
      handler(event);
    } else {
      logger.warn("No handler for event", { event: event.event });
    }
  }
}

module.exports = new ContractEventService();
