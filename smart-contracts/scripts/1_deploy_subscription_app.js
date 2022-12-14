async function main() {

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log('Deploying Subscription app with the account:', deployerAddress);

  const SubscriptionApp = await ethers.getContractFactory('SubscriptionApp');
  const subscriptionApp = await SubscriptionApp.deploy();
  await subscriptionApp.deployed();

  console.log('subscriptionApp deployed to:', subscriptionApp.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
