const { ethers } = require("ethers");

class ReservationTransformer {
  fromChain(chainData, reservationId) {
    return {
      chainReservationId: reservationId,
      renterAddress: chainData.renter,
      carType: chainData.carType,
      pickUpDate: new Date(parseInt(chainData.pickUpDate) * 1000).toISOString(),
      dropOffDate: new Date(parseInt(chainData.dropOffDate) * 1000).toISOString(),
      confirmed: chainData.confirmed,
      source: "blockchain",
    };
  }

  toChainParams(reservation) {
    return {
      renterAddress: reservation.renterAddress,
      carType: reservation.carName,
      pickUpDate: Math.floor(new Date(reservation.pickUpDate).getTime() / 1000),
      dropOffDate: Math.floor(new Date(reservation.dropOffDate).getTime() / 1000),
    };
  }

  toPublicView(reservation) {
    return {
      id: reservation.id,
      carName: reservation.carName,
      pickUpDate: reservation.pickUpDate,
      dropOffDate: reservation.dropOffDate,
      pickUpLocation: reservation.pickUpLocation,
      dropOffLocation: reservation.dropOffLocation,
      status: reservation.status,
      pricing: reservation.pricing,
      chainReservationId: reservation.chainReservationId,
      txHash: reservation.txHash,
      createdAt: reservation.createdAt,
    };
  }

  toAdminView(reservation) {
    return {
      ...this.toPublicView(reservation),
      renterAddress: reservation.renterAddress,
      personalInfo: reservation.personalInfo,
      txDetails: reservation.txDetails,
      updatedAt: reservation.updatedAt,
    };
  }
}

module.exports = new ReservationTransformer();
