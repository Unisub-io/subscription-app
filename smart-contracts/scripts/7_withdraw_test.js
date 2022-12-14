const SubscriptionAppArtifact = require('../artifacts/contracts/SubscriptionApp.sol/SubscriptionApp.json');

async function main() {

  const [deployer, merchant, customer1, customer2] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const merchantAddress = await merchant.getAddress();
  const customer1Address = await customer1.getAddress();
  const customer2Address = await customer2.getAddress();

  console.log('All addresses');
  console.log(deployerAddress);
  console.log(merchantAddress);
  console.log(customer1Address);
  console.log(customer2Address);

  // const APP_ADDRESS = "0x3d6C27C8aE6e357E5077C1Bc042da5a4f4f05A7A"
  // const APP_ADDRESS = "0x10360Cae6E622E14d95558891a12634a7bf443d1"
  const APP_ADDRESS = "0x56603e92FfFa43b198C5A4C4bF3B6B90FAc8144E"
  const WETH_ADDRESS = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6"

    const appContractOnMerchant =  new ethers.Contract(
        APP_ADDRESS,
        SubscriptionAppArtifact.abi,
        merchant
    );


    // Payment for customer 1 will go through as non gas saving
    const processWithdraw = await appContractOnMerchant.withdrawBatch([WETH_ADDRESS]);
    await processWithdraw.wait();

}

main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
