async function main() {

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log('Deploying subscription app');

    const platformFee = 50;


  const contractFactory = await ethers.getContractFactory("SubscriptionApp");
  const app = await upgrades.deployProxy(contractFactory, [platformFee]);
  await app.deployed();

  console.log(`subscription app at: ${app.address} `);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
