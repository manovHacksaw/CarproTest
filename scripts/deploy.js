const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const backendAddress = process.env.BACKEND_WALLET_ADDRESS;
  if (!backendAddress) {
    throw new Error("BACKEND_WALLET_ADDRESS not set in .env");
  }

  console.log("Deploying CarRental with authorized backend:", backendAddress);

  const CarRental = await ethers.getContractFactory("CarRental");
  const carRental = await CarRental.deploy(backendAddress);
  await carRental.deployed();

  console.log("CarRental deployed to:", carRental.address);
  console.log("Authorized backend:", backendAddress);
  console.log("Only this backend wallet can call write functions.");

  // Write deployed address to a file so backend can read it
  const fs = require("fs");
  const deployInfo = {
    contractAddress: carRental.address,
    authorizedBackend: backendAddress,
    deployedAt: new Date().toISOString(),
    network: (await ethers.provider.getNetwork()).name,
  };
  fs.writeFileSync("./backend/data/deployment.json", JSON.stringify(deployInfo, null, 2));
  console.log("Deployment info saved to backend/data/deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
