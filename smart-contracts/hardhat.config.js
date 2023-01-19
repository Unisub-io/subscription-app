require('dotenv').config();
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-truffle5');
require('hardhat-gas-reporter');
require('solidity-coverage');
require('@nomiclabs/hardhat-solhint');
require('hardhat-contract-sizer');
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');


const INFURA_PROJECT_ID = process.env.INFURA_PROJECT_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PRIVATE_KEY1 = process.env.PRIVATE_KEY1;
const PRIVATE_KEY2 = process.env.PRIVATE_KEY2;
const PRIVATE_KEY3 = process.env.PRIVATE_KEY3;

module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.4.24',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: '0.8.0',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }

        }
      },
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }

        }
      },
      {
        version: '0.8.15',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }

        }
      },
    ],
  },
  gasReporter: {
    currency: 'USD',
    enabled: true,
    gasPrice: 21
  },
  networks: {
    // hardhat: {
    //   blockGasLimit: 80000000000000000,
    //   gasPrice: 1,
    //   optimizer: { enabled: true, runs: 200}
    // },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${PRIVATE_KEY}`],
      timeout: 360000000
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${INFURA_PROJECT_ID}`,
      accounts: [`0x${PRIVATE_KEY}`,`0x${PRIVATE_KEY1}`,`0x${PRIVATE_KEY2}`,`0x${PRIVATE_KEY3}`],
      gasPrice: 10000000000, // This is 10 gwei
    },
    mumbai: {
      // url: `https://polygon-mumbai.infura.io/v3/6e9690131f584ee0a8b445ebb4740f8b`,
      // url: `https://rpc-mumbai.matic.today`,
      url: `https://matic-mumbai.chainstacklabs.com`,
      accounts: [`0x${PRIVATE_KEY}`],
      timeout: 360000000
    },
    matic: {
      //  url: `https://polygon-rpc.com`,
      // url: `https://polygon-mainnet.infura.io/v3/6e9690131f584ee0a8b445ebb4740f8b`,
      //url: `https://matic-mainnet-full-rpc.bwarelabs.com`,
      // url: `https://rpc-mainnet.matic.network`,
      url: `https://matic-mainnet.chainstacklabs.com`,
      //  url: `https://matic-mainnet.chainstacklabs.com`,
      //url: `https://rpc-mainnet.maticvigil.com/v1/293c0f4455f0a5933014c66d2fb84f7ca257d16b`,
      accounts: [`0x${PRIVATE_KEY}`],
      gasPrice: 100000000000,
      timeout: 360000000
    },
    coverage: {
      url: 'http://localhost:8555',
      blockGasLimit: 30_000_000
    },
    hardhat: {
      gas: 30_000_000,
      blockGasLimit: 30_000_000,
      allowUnlimitedContractSize: true,
      timeout: 1800000

    }
  },
  mocha: {
    timeout: 2000000,
    blockGasLimit: 30_000_000_000
  }
};
