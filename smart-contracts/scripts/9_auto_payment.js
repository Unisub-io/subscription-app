const SubscriptionAppArtifact = require('../artifacts/contracts/SubscriptionApp.sol/SubscriptionApp.json');
const axios = require('axios');
const _ = require('lodash');
const fs = require('fs');
const nodemailer = require('nodemailer');
const {BN} = require("@openzeppelin/test-helpers");

function convertJSONtocsv(network, json) {
  if (json.length === 0) {
    return;
  }

  json.sort(function(a,b){
    return Object.keys(b).length - Object.keys(a).length;
  });

  // Change from order to orderId, from id to paymentId
  json = json.map(x=>{
    let i= x;
    // i.put("Order Id", i.remove("order"));
    // i.put("Payment Id", i.remove("id"));
    i.orderId = i.order;
    delete i.order;
    i.paymentId = i.id;
    delete i.id;

    // Make the json change utc timestamp
    i.date = new Date(parseInt(i.timestamp)).toUTCString();

    i.network = network;

    return i;
  })



  const replacer = (key, value) => value === null ? '' : value // specify how you want to handle null values here
  const header = Object.keys(json[0]);

  var first = "date";
  var second = "status";
  var third = "orderId";
  var fourth = "customer";
  header.sort(function(x,y){ return x == fourth ? -1 : y == fourth ? 1 : 0; });
  header.sort(function(x,y){ return x == third ? -1 : y == third ? 1 : 0; });
  header.sort(function(x,y){ return x == second ? -1 : y == second ? 1 : 0; });
  header.sort(function(x,y){ return x == first ? -1 : y == first ? 1 : 0; });


  let csv = json.map(row => header.map(fieldName => JSON.stringify(row[fieldName], replacer)).join(','))

  csv.unshift(header.join(','))
  csv = csv.join('\r\n')

  fs.writeFileSync('payments.csv', csv)
}

async function main() {

  // Need to fill this out before running script.
  let merchantId = '0x5573b798c2cdbe36da493652fe86591804968cb9';
  let gasSavingsModeOn = false;
  let networkPaid = 'GOERLI';

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
  //const APP_ADDRESS = "0x4bA75555E692C7C400322C96b9264A0a7f0a4719" //mumbai
  //const APP_ADDRESS = "0x5CF590F30236D6193626CAa02Dd4de9e2bBb3394" //polygon

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

  console.log('z.data.subscriptions');
  console.log(z.data.subscriptions);
    let merchantSubs = z.data.subscriptions.filter(x=>{return x.approvedPeriodsRemaining > 0}); // "available to charge"

    // Build up a list of orders to submit to the batch processing
  let MAX_SINGLE_TX = 10;
  const chunks = _.chunk(merchantSubs, MAX_SINGLE_TX);

  let transactionInformation = [];
  let totalGasSpent = 0;

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

    console.log('Waiting for transaction to be picked up by network...');

    // // Payment for customer will go through as non gas saving
    const processPayment = await appContractOnMerchant.batchProcessPayment(chunkIds, chunkCustomers, gasSavingsModeOn);
    const processPaymentReturnResult = await processPayment.wait();
    console.log('The logs');
    console.log('Number of payments trying to make ');
    console.log(chunky.length);
    let gasExpenditure = ethers.utils.formatEther(processPaymentReturnResult.gasUsed.mul(processPaymentReturnResult.effectiveGasPrice));
    console.log('total gas consumed: \t', processPaymentReturnResult.gasUsed.toString())
    console.log('total gas price: \t (gwei)', (parseFloat(processPaymentReturnResult.effectiveGasPrice.toString())/ 1000000000));
    console.log('total ether spent on gas for transaction: \t (eth)', gasExpenditure)
    totalGasSpent = totalGasSpent + parseFloat(gasExpenditure);


    console.log('Payments completed');

    transactionInformation.push({
      transactionNumber: i,
      txHash: processPayment.hash,
      gasSpentOnTransaction: gasExpenditure,
      numberOfCustomersInThisTransaction: chunky.length
    });
  }

  // Wait for 10 seconds so the graph can process what just happened
  await new Promise(resolve => setTimeout(resolve, 20000));

  z = await axios({
    method: 'get',
    url: `${BACKEND_URL}/getsubsbymerchant/${merchantId}/${onlyInvalid}`,
    headers: { Authorization: `Bearer ${accessKey}` }
  });

  console.log('Updated info');
  console.log('z.data.subscriptions');
  console.log(z.data.subscriptions);

  let failedMerchantSubs = z.data.subscriptions.filter(x=>{return x.approvedPeriodsRemaining > 0 && x.lastOutstandingPaymentFailed === true});
  let failedOrderIdsArray = failedMerchantSubs.map(x => x.id );

  // Refresh an all merchant subs
  let allMerchantSubs = z.data.subscriptions;

  // This shows for each merchant the failed ones
  console.log('--------------------');
  console.log('failedMerchantSubs');
  console.log(failedMerchantSubs);

  // Call for the successful and failed payments for each of the txs hashes
  let successfulPayments = [];
  let failedPayments = [];
  for(let j=0; j<transactionInformation.length; j++){
    // For each tx hash, check for any failed or completed payments, add them to a JSON Array
    let a1 = await axios({
      method: 'get',
      url: `${BACKEND_URL}/getsuccessfulpaymentsbytx/${transactionInformation[j].txHash}`,
      headers: { Authorization: `Bearer ${accessKey}` }
    });
    let a2 = await axios({
      method: 'get',
      url: `${BACKEND_URL}/getfailedpaymentsbytx/${transactionInformation[j].txHash}`,
      headers: { Authorization: `Bearer ${accessKey}` }
    });
    let successfulPayment = a1.data;
    let failedPayment = a2.data;
    console.log(a1.data);
    console.log(a2.data);
    // For successful payments, add them to the json and do any necessary computations with the return value from successful and failed (lastOutstandingPaymentFailed)
    successfulPayment.payments.forEach((value) => {
      successfulPayments.push(value);
    })

    failedPayment.payments.forEach((value) => {
      failedPayments.push(value);
    })
  }

  console.log(successfulPayments);
  console.log(failedPayments);

  for(let y=0; y<successfulPayments.length; y++){
    successfulPayments[y].status = 'success';
  }

  for(let z=0; z<failedPayments.length; z++){
    failedPayments[z].status = 'fail';
  }

  let allPayments = successfulPayments.concat(failedPayments);


  console.log(allMerchantSubs);
  for(let x=0; x<allPayments.length; x++){
    allPayments[x].merchant = allPayments[x].merchant.id;
    allPayments[x].customer = allPayments[x].customer.id;
    allPayments[x].customerOrder = allPayments[x].customerOrder.id;
    allPayments[x].order = allPayments[x].order.id;

    console.log(allPayments[x].customerOrder)
    // Check all merchant subs
    allPayments[x].approvedPeriodsRemaining = allMerchantSubs.find(sub => allPayments[x].customerOrder ===  sub.id).approvedPeriodsRemaining;
    allPayments[x].numberOfIntervalsPaid = allMerchantSubs.find(sub => allPayments[x].customerOrder ===  sub.id).numberOfIntervalsPaid;
    allPayments[x].nextPaymentTimestamp = allMerchantSubs.find(sub => allPayments[x].customerOrder ===  sub.id).nextPaymentTimestamp;
    allPayments[x].lastOutstandingPaymentFailed = allMerchantSubs.find(sub => allPayments[x].customerOrder ===  sub.id).lastOutstandingPaymentFailed;
    allPayments[x].amountPaidToDate = allMerchantSubs.find(sub => allPayments[x].customerOrder ===  sub.id).amountPaidToDate;
    allPayments[x].intervalDuration = allMerchantSubs.find(sub => allPayments[x].customerOrder ===  sub.id).order.intervalDuration;
    allPayments[x].chargePerInterval = allMerchantSubs.find(sub => allPayments[x].customerOrder ===  sub.id).order.chargePerInterval;
    allPayments[x].contractAddress = allMerchantSubs.find(sub => allPayments[x].customerOrder ===  sub.id).order.erc20.id;
    allPayments[x].totalGasSpent = `${totalGasSpent} ETH`;
  }

  console.log('===================');
  console.log('transactionInformation');
  console.log(transactionInformation);
  console.log('===================');
  console.log('totalGasSpent on all payments (ETH)');
  console.log(totalGasSpent);

  console.log('===================');
  console.log('Total Payment Report By Order Id');

  let res = Array.from(successfulPayments.reduce(
      (m, {order, amount}) => m.set(order, (m.get(order) || 0) + parseInt(amount)), new Map
  ), ([order, amount]) => ({order, amount}));

  console.log(res);


  // Create a report about the successful and failed payments
  convertJSONtocsv(networkPaid, allPayments);

  console.log('fin')
}

main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
