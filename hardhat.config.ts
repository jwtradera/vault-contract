import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.1",
  networks: {
    hardhat: {
      forking: {
        // eslint-disable-next-line
        enabled: true,
        url: `https://rpc.ankr.com/eth`,
      },
      gas: 10000000,
    }
  },
  mocha: {
    timeout: 0
  }
};

export default config;
