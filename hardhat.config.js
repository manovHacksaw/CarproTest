/**
* @type import('hardhat/config').HardhatUserConfig
*/

require('dotenv').config();
require("@nomiclabs/hardhat-ethers");

const { API_URL, PRIVATE_KEY } = process.env;

module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: { enabled: false },
    },
  },
  paths: {
    sources: "./contracts",
  },
  networks: {
    ...(API_URL && PRIVATE_KEY ? {
      sepolia: {
        gasPrice: 20000000000,
        url: API_URL,
        accounts: [`0x${PRIVATE_KEY}`]
      }
    } : {})
  },
}