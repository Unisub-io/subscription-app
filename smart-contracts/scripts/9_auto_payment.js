const SubscriptionAppArtifact = require('../artifacts/contracts/SubscriptionApp.sol/SubscriptionApp.json');
const axios = require('axios');
const _ = require('lodash');

async function main() {

  // Need to fill this out before running script.
  let merchantId = '0x5573b798c2cdbe36da493652fe86591804968cb9';
  let gasSavingsModeOn = false;

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

  merchantId = merchantId.toLowerCase();
  console.log('merchantId');
  console.log(merchantId);

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log('Deployer address');
  console.log(deployerAddress);

  const APP_ADDRESS = "0x639e1B11303cb337835B655Bfc74de0c4c771c90"

    const appContractOnMerchant =  new ethers.Contract(
        APP_ADDRESS,
        SubscriptionAppArtifact.abi,
        deployer // This is the address with some eth in it that is going to be used to settle payments
    );

    // Call the payments for the interval that has now passed
    const onlyInvalid = false;
    const failedPayment = false;
    let z;
    z = await axios({
      method: 'get',
      url: `${BACKEND_URL}/getpendingpaymentsubsbymerchant/${merchantId}/${failedPayment}/${onlyInvalid}`,
      headers: { Authorization: `Bearer ${accessKey}` }
    });

    //    let merchantSubs = z.data.subscriptions;
  console.log('z.data.subscriptions');
  console.log(z.data.subscriptions);
    let merchantSubs = z.data.subscriptions.filter(x=>{return x.approvedPeriodsRemaining > 0});

    // Build up a list of orders to submit to the batch processing
  let MAX_SINGLE_TX = 10;
  const chunks = _.chunk(merchantSubs, MAX_SINGLE_TX);

  for(let i = 0; i< chunks.length ; i++){
    const chunky = chunks[i];
    console.log("----");
  //  console.log(chunky);

    const chunkIds = chunky.map((x)=> {
      return x.order.id;
    });
    console.log(chunkIds);

    const chunkCustomers = chunky.map((x)=> {
      return x.customer.id;
    })
    console.log(chunkCustomers);

    // // Payment for customer will go through as non gas saving
    const processPaymentNoGasSaving = await appContractOnMerchant.batchProcessPayment(chunkIds, chunkCustomers, gasSavingsModeOn);
    await processPaymentNoGasSaving.wait();

    console.log('Paid portion of customers...');
  }

  // Wait for 10 seconds so the graph can process what just happened
  await new Promise(resolve => setTimeout(resolve, 10000));

  z = await axios({
    method: 'get',
    url: `${BACKEND_URL}/getpendingpaymentsubsbymerchant/${merchantId}/${failedPayment}/${onlyInvalid}`,
    headers: { Authorization: `Bearer ${accessKey}` }
  });

  console.log('Updated info');
  console.log('z.data.subscriptions');
  console.log(z.data.subscriptions);


  // TODO check merchantsubs vs the "failedpending payment" category to get an export of the "failed" payments (the api also picks up on this, but is global and does not yet have filters/email)

  // TODO Create a report about the successful and failed payments

  // TODO Email a report to the stakeholders
}

main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
