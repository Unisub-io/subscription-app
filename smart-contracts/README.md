## Subscription App

### Setup

* Install dependencies `yarn`
* Create `.env` file with properties from `.env.example` 

### Running tests

```
yarn test

yarn test ./test/SubscriptionApp.test.js 
```

### Coverage

```
yarn run coverage
```
Example run of coverage with specific options:

```
yarn run coverage --testfiles "test/SubscriptionApp.test.js"
```

### Deployment scripts

```
npx buidler run --network rinkeby scripts/1_deploy_subscription_app.js
```
npx hardhat run --network goerli scripts/1_deploy_subscription_app.js


Flatten with
sol-merger --export-plugin SPDXLicenseRemovePlugin "contracts/SubscriptionApp.sol" ./flattened-new
