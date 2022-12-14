# Subscription App

## Smart Contracts

* Built using [buidler/hardhat](https://buidler.dev/) 
* Contracts based on [OpenZeppelin](https://github.com/OpenZeppelin/openzeppelin-contracts)

### Setup

* Move to repo folder `cd smart-contracts`
* Install dependencies `yarn`
* Run tests `yarn test`
* Run tests `yarn test ./test/SubscriptionApp.test.js `

#### Running GAS reports
* in its own terminal tab run: `npx buidler node`
* Run test with `GAS` profiling `yarn test-with-gas`

To deploy to network
npx yarn graph deploy --ipfs https://api.thegraph.com/ipfs/ --node https://api.thegraph.com/deploy/ --access-token youraccesstokenhere onigiri-x/subscription-app2