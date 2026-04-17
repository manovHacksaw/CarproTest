const { ethers } = require("ethers");

function toUnixTimestamp(dateStr) {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

function fromUnixTimestamp(unix) {
  return new Date(parseInt(unix) * 1000).toISOString();
}

function formatWei(wei) {
  return ethers.utils.formatEther(wei.toString());
}

function parseEth(eth) {
  return ethers.utils.parseEther(eth.toString());
}

function formatGwei(wei) {
  return ethers.utils.formatUnits(wei.toString(), "gwei");
}

function isValidTxHash(hash) {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

function isValidAddress(address) {
  return ethers.utils.isAddress(address);
}

function encodeBookCarData(abi, renterAddress, carType, pickUpDate, dropOffDate) {
  const iface = new ethers.utils.Interface(abi);
  return iface.encodeFunctionData("bookCar", [renterAddress, carType, pickUpDate, dropOffDate]);
}

function decodeTransactionInput(abi, data) {
  try {
    const iface = new ethers.utils.Interface(abi);
    return iface.parseTransaction({ data });
  } catch {
    return null;
  }
}

function decodeEventLog(abi, log) {
  try {
    const iface = new ethers.utils.Interface(abi);
    return iface.parseLog(log);
  } catch {
    return null;
  }
}

module.exports = {
  toUnixTimestamp,
  fromUnixTimestamp,
  formatWei,
  parseEth,
  formatGwei,
  isValidTxHash,
  isValidAddress,
  encodeBookCarData,
  decodeTransactionInput,
  decodeEventLog,
};
