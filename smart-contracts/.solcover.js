module.exports = {
   // client: require("ganache-cli"), // This will use ganache specified in your own dev dependencies
    // measureStatementCoverage: false,
    // measureFunctionCoverage: false,
    skipFiles:[
        'mock/SubscriptionAppMock.sol',
    ],
    providerOptions: {
        gasLimit: 0x1fffffffffffff,
        allowUnlimitedContractSize: true,
        default_balance_ether: 0x1fffffffffffff,
    }
}
