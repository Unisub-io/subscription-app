const SubscriptionAppArtifact = require('../artifacts/contracts/SubscriptionApp.sol/SubscriptionApp.json');
const WethArtifact = require('../artifacts/contracts/WethToken.sol/WethToken.json');

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

  // 10,000 gwei, minute, weth address on goerli
  const addOrder = await appContractOnMerchant.createNewOrder(10000, 8, WETH_ADDRESS);
  await addOrder.wait();

  let orderNumber = 0; // Order number from previous step


  let customerAddresses = [customer1, customer2];

  // Customer accepts the order
  for(let i=0; i< customerAddresses.length; i++){

    const wethContractOnCustomer =  new ethers.Contract(
        WETH_ADDRESS,
        WethArtifact.abi,
        customerAddresses[i]
    );
    const approveOrder = await wethContractOnCustomer.approve(APP_ADDRESS, '10000000000000000');
    await approveOrder.wait();

    const appContractOnCustomer =  new ethers.Contract(
        APP_ADDRESS,
        SubscriptionAppArtifact.abi,
        customerAddresses[i]
    );
    const acceptOrder = await appContractOnCustomer.customerAcceptOrder(orderNumber, 0);
    await acceptOrder.wait();
  }


}

main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
