const { v4: uuidv4 } = require("uuid");
const db = require("../models/db");
const blockchainService = require("./blockchainService");
const pricingService = require("./pricingService");
const { validateDateRange } = require("../utils/helpers");
const logger = require("../utils/logger");

async function createReservation({ renterAddress, carName, pickUpDate, dropOffDate, pickUpLocation, dropOffLocation, personalInfo }) {
  // Validate dates
  const dateCheck = validateDateRange(pickUpDate, dropOffDate);
  if (!dateCheck.valid) throw new Error(dateCheck.message);

  // Validate car exists
  const car = pricingService.getCarByName(carName);
  if (!car) throw new Error(`Car not found: ${carName}`);

  // Check availability
  const existing = db.getReservations().filter(
    (r) => r.carName === carName && r.status !== "cancelled" &&
      new Date(r.pickUpDate) < new Date(dropOffDate) &&
      new Date(r.dropOffDate) > new Date(pickUpDate)
  );
  if (existing.length > 0) throw new Error("Car is not available for selected dates");

  // Calculate pricing
  const pricing = pricingService.getPriceQuote(carName, pickUpDate, dropOffDate);

  const reservation = {
    id: uuidv4(),
    renterAddress,
    carName,
    carId: car.id,
    pickUpDate,
    dropOffDate,
    pickUpLocation,
    dropOffLocation,
    pricing,
    personalInfo,
    status: "pending",
    chainReservationId: null,
    txHash: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.saveReservation(reservation);
  db.upsertUser(renterAddress, { lastActivity: new Date().toISOString() });

  try {
    const { receipt, chainReservationId } = await blockchainService.bookCarOnChain(
      renterAddress, carName, pickUpDate, dropOffDate
    );
    const withChain = {
      ...reservation,
      chainReservationId,
      txHash: receipt.transactionHash,
      updatedAt: new Date().toISOString(),
    };
    db.saveReservation(withChain);
    logger.info("Reservation created and booked on-chain", { id: reservation.id, chainReservationId, txHash: receipt.transactionHash });
    return withChain;
  } catch (err) {
    logger.error("On-chain booking failed, reservation saved locally only", { id: reservation.id, error: err.message });
    return reservation;
  }
}

async function confirmReservation(reservationId) {
  const reservation = db.getReservationById(reservationId);
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.status === "cancelled") throw new Error("Cannot confirm a cancelled reservation");
  if (reservation.chainReservationId === null || reservation.chainReservationId === undefined)
    throw new Error("No on-chain reservation ID — booking may not have been submitted to the blockchain");

  await blockchainService.confirmReservationOnChain(reservation.chainReservationId);

  const updated = {
    ...reservation,
    status: "confirmed",
    updatedAt: new Date().toISOString(),
  };

  db.saveReservation(updated);
  db.updateAnalytics(reservation.carName, reservation.pricing.discountedEth);
  logger.info("Reservation confirmed on-chain", { id: reservationId, chainReservationId: reservation.chainReservationId });

  return updated;
}

async function cancelReservation(reservationId, renterAddress) {
  const reservation = db.getReservationById(reservationId);
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.renterAddress.toLowerCase() !== renterAddress.toLowerCase())
    throw new Error("Unauthorized: only the renter can cancel");
  if (reservation.status === "cancelled") throw new Error("Already cancelled");

  // Call on-chain so refund policy runs in the contract
  if (reservation.chainReservationId !== null && reservation.chainReservationId !== undefined) {
    try {
      await blockchainService.cancelReservationOnChain(reservation.chainReservationId);
      logger.info("Cancellation written to chain", { id: reservationId, chainReservationId: reservation.chainReservationId });
    } catch (err) {
      logger.error("On-chain cancellation failed", { id: reservationId, error: err.message });
      throw new Error("On-chain cancellation failed: " + err.message);
    }
  }

  const updated = {
    ...reservation,
    status: "cancelled",
    updatedAt: new Date().toISOString(),
  };

  db.saveReservation(updated);
  logger.info("Reservation cancelled", { id: reservationId, renterAddress });
  return updated;
}

async function syncChainReservations() {
  logger.info("Syncing reservations from blockchain...");
  const chainReservations = await blockchainService.getAllReservationsFromChain();
  for (const cr of chainReservations) {
    db.saveEvent({ type: "ChainSync", ...cr, syncedAt: new Date().toISOString() });
  }
  logger.info("Chain sync complete", { count: chainReservations.length });
  return chainReservations;
}

module.exports = { createReservation, confirmReservation, cancelReservation, syncChainReservations };
