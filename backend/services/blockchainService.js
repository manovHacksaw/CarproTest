const { ethers } = require("ethers");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { RPC_URL, PRIVATE_KEY } = require("../config/config");
const logger = console;
const db = require("../models/db");

const ABI_PATH = path.resolve(__dirname, "../../src/ABI/abi.json");
const DEPLOYMENT_PATH = path.resolve(__dirname, "../data/deployment.json");
const CONTRACT_PATH = path.resolve(__dirname, "../../contracts/CarRental.sol");

let provider, signer, contract, contractAddress;

// ── Provider / Signer ─────────────────────────────────────────────────────────
function getProvider() {
  if (!provider) provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  return provider;
}

function getSigner() {
  if (!signer) {
    if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY not set in backend .env");
    signer = new ethers.Wallet(PRIVATE_KEY, getProvider());
  }
  return signer;
}

function getContract() {
  if (!contract) {
    if (!contractAddress) throw new Error("Contract not deployed yet");
    const abi = JSON.parse(fs.readFileSync(ABI_PATH, "utf-8"));
    // Always use signer so backend is the msg.sender for all calls
    contract = new ethers.Contract(contractAddress, abi, getSigner());
  }
  return contract;
}

// ── Auto Compile ──────────────────────────────────────────────────────────────
async function compileContract() {
  logger.info("Compiling CarRental.sol...");
  try {
    execSync("npx hardhat compile", { cwd: path.resolve(__dirname, "../../"), stdio: "pipe" });
    logger.info("Contract compiled successfully");

    // Copy fresh ABI from hardhat artifacts
    const artifactPath = path.resolve(
      __dirname, "../../artifacts/contracts/CarRental.sol/CarRental.json"
    );
    if (fs.existsSync(artifactPath)) {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
      fs.writeFileSync(ABI_PATH, JSON.stringify(artifact.abi, null, 2));
      logger.info("ABI updated from compiled artifact");
    }
  } catch (err) {
    logger.error("Compilation failed", { error: err.message });
    throw new Error("Contract compilation failed: " + err.message);
  }
}

// ── Auto Deploy ───────────────────────────────────────────────────────────────
async function deployContract() {
  logger.info("Deploying CarRental contract...");
  const backendAddress = getSigner().address;
  logger.info("Backend wallet (authorized signer):", { address: backendAddress });

  const abi = JSON.parse(fs.readFileSync(ABI_PATH, "utf-8"));

  // Get bytecode from artifact
  const artifactPath = path.resolve(
    __dirname, "../../artifacts/contracts/CarRental.sol/CarRental.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

  const factory = new ethers.ContractFactory(abi, artifact.bytecode, getSigner());
  const deployed = await factory.deploy(backendAddress);
  await deployed.deployed();

  contractAddress = deployed.address;
  contract = null; // reset so getContract() picks up new address

  const network = await getProvider().getNetwork();
  const deployInfo = {
    contractAddress,
    authorizedBackend: backendAddress,
    deployedAt: new Date().toISOString(),
    network: network.name,
    chainId: network.chainId,
  };

  const dataDir = path.dirname(DEPLOYMENT_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(DEPLOYMENT_PATH, JSON.stringify(deployInfo, null, 2));

  logger.info("Contract deployed", deployInfo);
  return deployInfo;
}

// ── Bootstrap: compile + deploy on startup ────────────────────────────────────
async function bootstrap() {
  // 1. Check blockchain node is reachable
  const status = await checkConnection();
  if (!status.connected) {
    throw new Error("Cannot reach blockchain node at " + RPC_URL + ". Run: npx hardhat node");
  }

  // 2. Compile
  await compileContract();

  // 3. Deploy fresh contract (backend is always the authorized signer)
  const info = await deployContract();

  // 4. Start event listeners
  startEventListener();

  return info;
}

// ── Connection Check ──────────────────────────────────────────────────────────
async function checkConnection() {
  try {
    const network = await getProvider().getNetwork();
    const blockNumber = await getProvider().getBlockNumber();
    return { connected: true, network: network.name, chainId: network.chainId, blockNumber };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// ── Contract Calls (all go through backend signer) ────────────────────────────
async function getReservationCount() {
  return (await getContract().reservationCount()).toNumber();
}

async function getReservationFromChain(reservationId) {
  const r = await getContract().getReservation(reservationId);
  return {
    renter: r.renter,
    carType: r.carType,
    pickUpDate: r.pickUpDate.toNumber(),
    dropOffDate: r.dropOffDate.toNumber(),
    confirmed: r.confirmed,
  };
}

async function getAllReservationsFromChain() {
  const count = await getReservationCount();
  const results = [];
  for (let i = 0; i < count; i++) {
    try {
      const r = await getReservationFromChain(i);
      if (r.renter !== ethers.constants.AddressZero) results.push({ id: i, ...r });
    } catch (_) {}
  }
  return results;
}

async function bookCarOnChain(renterAddress, carType, pickUpDate, dropOffDate) {
  const pickTs = Math.floor(new Date(pickUpDate).getTime() / 1000);
  const dropTs = Math.floor(new Date(dropOffDate).getTime() / 1000);
  // Read current rentalFee from chain and forward it as msg.value
  const fee = await getContract().rentalFee();
  const tx = await getContract().bookCar(renterAddress, carType, pickTs, dropTs, { value: fee });
  const receipt = await tx.wait();
  logger.info("bookCar tx confirmed", { txHash: receipt.transactionHash });
  return receipt;
}

async function confirmReservationOnChain(reservationId) {
  const tx = await getContract().confirmReservation(reservationId);
  const receipt = await tx.wait();
  logger.info("confirmReservation tx confirmed", { txHash: receipt.transactionHash });
  return receipt;
}

async function cancelReservationOnChain(reservationId) {
  const tx = await getContract().cancelReservation(reservationId);
  const receipt = await tx.wait();
  logger.info("cancelReservation tx confirmed", { txHash: receipt.transactionHash });
  return receipt;
}

// ── Payment Functions ─────────────────────────────────────────────────────────
async function getRentalFee() {
  const fee = await getContract().rentalFee();
  return { wei: fee.toString(), eth: ethers.utils.formatEther(fee) };
}

async function getContractBalance() {
  const bal = await getProvider().getBalance(contractAddress);
  return { wei: bal.toString(), eth: ethers.utils.formatEther(bal) };
}

async function getReservationPayment(reservationId) {
  const amount = await getContract().reservationPayments(reservationId);
  return { wei: amount.toString(), eth: ethers.utils.formatEther(amount) };
}

async function setRentalFee(feeWei) {
  const tx = await getContract().setRentalFee(feeWei);
  const receipt = await tx.wait();
  logger.info("setRentalFee tx confirmed", { txHash: receipt.transactionHash, feeWei });
  return receipt;
}

async function withdrawFunds() {
  const tx = await getContract().withdraw();
  const receipt = await tx.wait();
  logger.info("withdraw tx confirmed", { txHash: receipt.transactionHash });
  return receipt;
}

// ── Dispute Functions ─────────────────────────────────────────────────────────
async function raiseDisputeOnChain(reservationId, reason) {
  const tx = await getContract().raiseDispute(reservationId, reason);
  const receipt = await tx.wait();
  logger.info("raiseDispute tx confirmed", { txHash: receipt.transactionHash, reservationId });
  return receipt;
}

async function resolveDisputeOnChain(reservationId, refund) {
  const tx = await getContract().resolveDispute(reservationId, refund);
  const receipt = await tx.wait();
  logger.info("resolveDispute tx confirmed", { txHash: receipt.transactionHash, reservationId, refund });
  return receipt;
}

async function getDisputeFromChain(reservationId) {
  const d = await getContract().getDispute(reservationId);
  const outcomeMap = { 0: "None", 1: "Refunded", 2: "Rejected" };
  return {
    renter: d.renter,
    reason: d.reason,
    raised: d.raised,
    outcome: outcomeMap[d.outcome] ?? "None",
  };
}

async function getWalletBalance(address) {
  const bal = await getProvider().getBalance(address);
  return ethers.utils.formatEther(bal);
}

async function getTransactionDetails(txHash) {
  const tx = await getProvider().getTransaction(txHash);
  const receipt = await getProvider().getTransactionReceipt(txHash);
  return { tx, receipt };
}

function getDeploymentInfo() {
  if (!fs.existsSync(DEPLOYMENT_PATH)) return null;
  return JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, "utf-8"));
}

async function getContractInfo() {
  const deployment = getDeploymentInfo();
  const status = await checkConnection();
  return {
    contractAddress: contractAddress || deployment?.contractAddress || null,
    deployedAt: deployment?.deployedAt || null,
    network: deployment?.network || null,
    chainId: deployment?.chainId || null,
    authorizedBackend: deployment?.authorizedBackend || null,
    ...status,
  };
}

// ── Event Listeners ───────────────────────────────────────────────────────────
function startEventListener() {
  const c = getContract();

  c.on("CarBooked", (renter, carType, pickUpDate, dropOffDate, event) => {
    const data = { type: "CarBooked", renter, carType, pickUpDate: pickUpDate.toNumber(), dropOffDate: dropOffDate.toNumber(), txHash: event.transactionHash, blockNumber: event.blockNumber };
    db.saveEvent(data);
    logger.info("Event: CarBooked", data);
  });

  c.on("ReservationConfirmed", (reservationId, event) => {
    const data = { type: "ReservationConfirmed", reservationId: reservationId.toNumber(), txHash: event.transactionHash, blockNumber: event.blockNumber };
    db.saveEvent(data);
    logger.info("Event: ReservationConfirmed", data);
  });

  c.on("ReservationCanceled", (reservationId, event) => {
    const data = { type: "ReservationCanceled", reservationId: reservationId.toNumber(), txHash: event.transactionHash, blockNumber: event.blockNumber };
    db.saveEvent(data);
    logger.info("Event: ReservationCanceled", data);
  });

  c.on("PaymentReceived", (reservationId, renter, amount, event) => {
    const data = { type: "PaymentReceived", reservationId: reservationId.toNumber(), renter, amountEth: ethers.utils.formatEther(amount), txHash: event.transactionHash, blockNumber: event.blockNumber };
    db.saveEvent(data);
    logger.info("Event: PaymentReceived", data);
  });

  c.on("FundsWithdrawn", (owner, amount, event) => {
    const data = { type: "FundsWithdrawn", owner, amountEth: ethers.utils.formatEther(amount), txHash: event.transactionHash, blockNumber: event.blockNumber };
    db.saveEvent(data);
    logger.info("Event: FundsWithdrawn", data);
  });

  c.on("DisputeRaised", (reservationId, renter, reason, event) => {
    const data = { type: "DisputeRaised", reservationId: reservationId.toNumber(), renter, reason, txHash: event.transactionHash, blockNumber: event.blockNumber };
    db.saveEvent(data);
    logger.info("Event: DisputeRaised", data);
  });

  c.on("DisputeResolved", (reservationId, resolver, refunded, event) => {
    const data = { type: "DisputeResolved", reservationId: reservationId.toNumber(), resolver, refunded, txHash: event.transactionHash, blockNumber: event.blockNumber };
    db.saveEvent(data);
    logger.info("Event: DisputeResolved", data);
  });

  logger.info("Blockchain event listeners active");
}

module.exports = {
  bootstrap,
  checkConnection,
  getReservationCount,
  getReservationFromChain,
  getAllReservationsFromChain,
  bookCarOnChain,
  confirmReservationOnChain,
  cancelReservationOnChain,
  getWalletBalance,
  getTransactionDetails,
  getDeploymentInfo,
  getContractInfo,
  getContract,
  getSigner,
  getProvider,
  getRentalFee,
  getContractBalance,
  getReservationPayment,
  setRentalFee,
  withdrawFunds,
  raiseDisputeOnChain,
  resolveDisputeOnChain,
  getDisputeFromChain,
};
