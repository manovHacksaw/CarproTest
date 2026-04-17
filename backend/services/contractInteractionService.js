const blockchainService = require("./blockchainService");
const { ethers } = require("ethers");
const logger = console;

class ContractInteractionService {
  async executeBookCar(renterAddress, carType, pickUpDate, dropOffDate) {
    try {
      const contract = blockchainService.getContract();
      const fee = await contract.rentalFee();
      const tx = await contract.bookCar(renterAddress, carType, pickUpDate, dropOffDate, { value: fee });

      logger.info("BookCar transaction sent", { txHash: tx.hash });
      
      const receipt = await tx.wait();
      logger.info("BookCar transaction confirmed", {
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (err) {
      logger.error("BookCar failed", { error: err.message });
      throw new Error(`Blockchain booking failed: ${err.message}`);
    }
  }

  async executeConfirmReservation(reservationId) {
    try {
      const contract = blockchainService.getContract();
      const tx = await contract.confirmReservation(reservationId);
      
      logger.info("ConfirmReservation transaction sent", { txHash: tx.hash });
      
      const receipt = await tx.wait();
      logger.info("ConfirmReservation confirmed", {
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      });

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (err) {
      logger.error("ConfirmReservation failed", { error: err.message });
      throw new Error(`Blockchain confirmation failed: ${err.message}`);
    }
  }

  async executeCancelReservation(reservationId) {
    try {
      const contract = blockchainService.getContract();
      const tx = await contract.cancelReservation(reservationId);
      
      logger.info("CancelReservation transaction sent", { txHash: tx.hash });
      
      const receipt = await tx.wait();
      logger.info("CancelReservation confirmed", {
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      });

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (err) {
      logger.error("CancelReservation failed", { error: err.message });
      throw new Error(`Blockchain cancellation failed: ${err.message}`);
    }
  }

  async getReservationDetails(reservationId) {
    try {
      const contract = blockchainService.getContract();
      const [renter, carType, pickUpDate, dropOffDate, confirmed] = 
        await contract.getReservation(reservationId);

      return {
        reservationId,
        renter,
        carType,
        pickUpDate: pickUpDate.toString(),
        dropOffDate: dropOffDate.toString(),
        confirmed,
      };
    } catch (err) {
      logger.error("Get reservation failed", { reservationId, error: err.message });
      throw new Error(`Failed to fetch reservation: ${err.message}`);
    }
  }

  async getReservationCount() {
    try {
      const contract = blockchainService.getContract();
      const count = await contract.reservationCount();
      return parseInt(count.toString());
    } catch (err) {
      logger.error("Get reservation count failed", { error: err.message });
      throw new Error(`Failed to fetch count: ${err.message}`);
    }
  }

  async getAuthorizedBackend() {
    try {
      const contract = blockchainService.getContract();
      const backend = await contract.authorizedBackend();
      return backend;
    } catch (err) {
      logger.error("Get authorized backend failed", { error: err.message });
      throw new Error(`Failed to fetch backend: ${err.message}`);
    }
  }

  async getContractOwner() {
    try {
      const contract = blockchainService.getContract();
      const owner = await contract.owner();
      return owner;
    } catch (err) {
      logger.error("Get owner failed", { error: err.message });
      throw new Error(`Failed to fetch owner: ${err.message}`);
    }
  }
}

module.exports = new ContractInteractionService();
