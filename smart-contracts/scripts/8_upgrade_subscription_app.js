const { ethers, upgrades } = require("hardhat");

const {
  ether,
} = require('@openzeppelin/test-helpers');

const _ = require('lodash');

async function main() {
  const [deployer] = await ethers.getSigners();

  const SubsFactory = await ethers.getContractFactory("SubscriptionApp");
  const subs = await upgrades.upgradeProxy("0x56603e92fffa43b198c5a4c4bf3b6b90fac8144e", SubsFactory);
  await subs.deployed();
  console.log(subs.address);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
