async function main() {

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log('upgrading');

    const platformFee = 50;



  const UpgradeApp = await ethers.getContractFactory('SubscriptionApp');
  console.log('Upgrading Box...');
  await upgrades.upgradeProxy('0x80E04D1313cFD5AF97B275E0E07021C0bB627F46', UpgradeApp);
  console.log('Box upgraded');

  console.log(`subscription app at: ${app.address} `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
