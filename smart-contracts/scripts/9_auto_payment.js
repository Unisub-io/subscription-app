const SubscriptionAppArtifact = require('../artifacts/contracts/SubscriptionApp.sol/SubscriptionApp.json');
const axios = require('axios');

async function main() {

  const username = "admin";
  const password = "adminsubs";
  const BACKEND_URL = 'https://goldfish-app-4wplg.ondigitalocean.app';
  let r;

    r = await axios({
      method: 'post',
      url: `${BACKEND_URL}/auth/login`,
      data: { username, password },
    });

    let accessKey = r.data.access_token;

  // Get merchant that we want to process in this go

  let merchantId = '0x6d70E79fC60b495fF61B6f23CBE0Ec971103D32b';
  merchantId = merchantId.toLowerCase();
  console.log('merchantId');
  console.log(merchantId);

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();


  console.log('All addresses');
  console.log(deployerAddress);

  // const APP_ADDRESS = "0x3d6C27C8aE6e357E5077C1Bc042da5a4f4f05A7A"
  // const APP_ADDRESS = "0x10360Cae6E622E14d95558891a12634a7bf443d1"
  const APP_ADDRESS = "0x639e1B11303cb337835B655Bfc74de0c4c771c90"

    const appContractOnMerchant =  new ethers.Contract(
        APP_ADDRESS,
        SubscriptionAppArtifact.abi,
        deployer // This is the address with some eth in it that is going to be used to settle payments
    );

    // Call the payments for the interval that has now passed
    const onlyInvalid = false;
    let z;
    z = await axios({
      method: 'get',
      url: `${BACKEND_URL}/getsubsbymerchant/${merchantId}/${onlyInvalid}`,
      headers: { Authorization: `Bearer ${accessKey}` }
    });

    let merchantSubs = z.data.subscriptions;

    console.log(merchantSubs);

    // // Payment for customer 1 will go through as non gas saving
    // const processPaymentNoGasSaving = await appContractOnMerchant.batchProcessPayment([orderNumber],[customer1Address], false);
    // await processPaymentNoGasSaving.wait();
    //
    // // Payment for customer 2 will go through as gas saving
    // const processPaymentWithGasSaving = await appContractOnMerchant.batchProcessPayment([orderNumber],[customer2Address], true);
    // await processPaymentWithGasSaving.wait();

}

main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
