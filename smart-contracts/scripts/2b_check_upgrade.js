const { upgrades } = require('hardhat');
async function main() {

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log('upgrading');

   const UpgradeApp = await ethers.getContractFactory("SubscriptionApp");

  const proxyAddress = "0xA5e2408D048Eb4ad52aA212Fc9Fd64F9e0054adb"; // The actual proxy
  const kind = "transparent";

  console.log(`Force-importing proxy at ${proxyAddress}...`);

 // await upgrades.forceImport(proxyAddress, UpgradeApp, { kind });

  console.log(`Try prepare proxy at ${proxyAddress}...`);

  await upgrades.prepareUpgrade(proxyAddress, UpgradeApp);

    await upgrades.upgradeProxy(proxyAddress, UpgradeApp);

  console.log('✅ Upgrade simulation passed.');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
