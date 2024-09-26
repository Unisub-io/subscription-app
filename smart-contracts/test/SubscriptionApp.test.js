//const { upgrades} = require( "@openzeppelin/hardhat-upgrades");

const {
	expectRevert,
	expectEvent,
	BN,
	ether,
	send,
	constants,
	balance,
	time
} = require('@openzeppelin/test-helpers');

const {expect} = require('chai');

const SubscriptionApp = artifacts.require('SubscriptionAppMock.sol');
const TotalSupplyMock = artifacts.require('TotalSupplyMock.sol');
const WethToken = artifacts.require('WethToken.sol');
const GLDToken = artifacts.require('GLDToken.sol');
const SubscriptionAppReal = artifacts.require('SubscriptionApp.sol');
let customerIdBytes32;
let customerIdBytes32V2;

function stringToBytes32(str) {
	return ethers.utils.formatBytes32String(str);
}

function bytes32ToString(bytes32) {
	return ethers.utils.parseBytes32String(bytes32);
}


contract('SubscriptionApp', (accounts) => {
	const [admin, smartContract, merchantUser, customerUser, provider, anotherAccount] = accounts;

	const chargeCustomerPerInterval = 1000000; // 1 million wei of charge
	const extraBudgetCustomerPerInterval = 2000000; // 2 million wei of charge
	const cycleStartTime = 1;
	const cycleIntervalDuration = 3; // Monthly charges
	const platformFee = 50; // 5 %
	const erc20Address = '0x1111111111111111111111111111111111111111'; // TODO
	// this means 1 month at a time, uint256 _cycleStartTime, uint256 _cycleIntervalDuration, address _erc20
	const extraAmount = 100000; // 100k wei extra budget
	const lockDownPeriodExtraBudgetPayment = 604800; // 7 days in seconds



	beforeEach(async () => {

		this.app = await SubscriptionApp.new({from: admin});

		this.totalSupplyMock = await TotalSupplyMock.new({from: admin});

		customerIdBytes32 = stringToBytes32("customer1");
		customerIdBytes32V2 = stringToBytes32("customer2");

		await this.app.initialize(50);
		await this.totalSupplyMock.initialize(50);

		this.weth = await WethToken.new(
			{ from: admin }
		);

		// Setup some test tokens
		// Get a bit of weth on the payers account
		await this.weth.deposit({from: customerUser, value: 2000000000}); // 2 billion wei of weth

		// Our erc20 is the GOLD token, we can use this to test as well as ETH.
		this.erc20 = await GLDToken.new(100000000, {from: admin}); // 100 million wei of gold
		await this.erc20.transfer(customerUser, 100000000, {from: admin}); // 100 million wei of gold, transfer all to customer

	});
	describe('Basic tests and creating orders', () => {
		it('successfully call subscriptionApp changeOwner', async () => {
			await this.app.changeOwner('0x0000000000000000000000000000000000000001');
		});

		it('successfully revert for change owner wrong owner subscriptionApp changeOwner', async () => {
			await expectRevert(
				this.app.changeOwner('0x0000000000000000000000000000000000000001', {from: anotherAccount}),
				"Caller is not the owner"
			);
		});
		it('successfully revert for change owner 0 owner subscriptionApp changeOwner', async () => {
			await expectRevert(
				this.app.changeOwner('0x0000000000000000000000000000000000000000'),
				"Cannot change owner to 0"
			);
		});

		it('successfully call changePlatformFee to 10%', async () => {
			await this.app.changeDefaultPlatformFee(100);
		});

		it('successfully revert for changeDefaultPlatformFee wrong owner', async () => {
			await expectRevert(
				this.app.changeDefaultPlatformFee(100, {from: anotherAccount}),
				"Caller is not the owner"
			);
		});

		it('successfully call subscriptionApp real constructor', async () => {
			this.app = await SubscriptionAppReal.new({from: admin});
			await this.app.initialize(platformFee);
			// Try to create an order as well
			await this.app.createNewOrder(chargeCustomerPerInterval,extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0,  {from: merchantUser});
		});


		it('successfully call to create an order by the merchant', async () => {
			await this.app.setNowOverride(1);
			const {receipt} = await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, {from: merchantUser});
			await expectEvent(receipt, 'OrderCreated', {
				orderId: (new BN('0')),
				merchant: merchantUser,
				chargePerInterval: (new BN(chargeCustomerPerInterval)),
				extraBudgetPerInterval:  (new BN(extraBudgetCustomerPerInterval)),
				startTime: (new BN(cycleStartTime)),
				intervalDuration: (new BN(cycleIntervalDuration)),
				erc20: this.erc20.address,
				merchantDefaultNumberOfOrderIntervals: (new BN('36'))
			});

			const {orderId, merchant, chargePerInterval, extraBudgetPerInterval, startTime, intervalDuration, erc20, paused, merchantDefaultNumberOfOrderIntervals, trialIntervals} = await this.app.getOrder(0);

			expect(orderId).to.be.bignumber.equal(new BN('0'));
			expect(merchant).to.be.equal(merchantUser);
			expect(chargePerInterval).to.be.bignumber.equal(new BN(chargeCustomerPerInterval));
			expect(extraBudgetPerInterval).to.be.bignumber.equal(new BN(extraBudgetCustomerPerInterval));
			expect(startTime).to.be.bignumber.equal(new BN(cycleStartTime));
			expect(intervalDuration).to.be.bignumber.equal(new BN(cycleIntervalDuration));
			expect(erc20).to.be.equal(this.erc20.address);
			expect(paused).to.be.equal(false);
			expect(merchantDefaultNumberOfOrderIntervals).to.be.bignumber.equal(new BN('36'));
			expect(trialIntervals).to.be.bignumber.equal(new BN('0'));
		});

		it('fails to create an order because the smart contract incompatible', async () => {
			await expectRevert(
				this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.app.address, 36, 0, {from: merchantUser}),
				"ERC20 token not compatible");

		});
		it('fails to create an order because the smart contract responds 0 supply', async () => {
			await expectRevert(
				this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.totalSupplyMock.address, 36, 0, {from: merchantUser}),
				"ERC20 token not compatible");

		});

		it('successfully calls to create an order and pauses', async () => {
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setOrderPauseState(0, true, {from: merchantUser});
		});

		it('successfully call to create an order by the merchantUser and change its default number of intervals', async () => {
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setMerchantDefaultNumberOfOrderIntervals(0, 10, {from: merchantUser});


			const {orderId, merchant, chargePerInterval, extraBudgetPerInterval, startTime, intervalDuration, erc20, paused, merchantDefaultNumberOfOrderIntervals, trialIntervals} = await this.app.getOrder(0);

			expect(orderId).to.be.bignumber.equal(new BN('0'));
			expect(merchant).to.be.equal(merchantUser);
			expect(chargePerInterval).to.be.bignumber.equal(new BN(chargeCustomerPerInterval));
			expect(extraBudgetPerInterval).to.be.bignumber.equal(new BN(extraBudgetCustomerPerInterval));
			expect(startTime).to.be.bignumber.equal(new BN('0'));
			expect(intervalDuration).to.be.bignumber.equal(new BN(cycleIntervalDuration));
			expect(erc20).to.be.equal(this.erc20.address);
			expect(paused).to.be.equal(false);
			expect(merchantDefaultNumberOfOrderIntervals).to.be.bignumber.equal(new BN('10'));
			expect(trialIntervals).to.be.bignumber.equal(new BN('0'));
		});

		it('successfully call to create an order by the merchantUser and pause it by owner', async () => {
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setOrderPauseState(0, true, {from: admin});
		});

		it('reverts when calling an order by the NOT the merchantUser to pause it', async () => {
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, {from: merchantUser});
			await expectRevert(
				this.app.setOrderPauseState(0, true, {from: customerUser}),
				"Only the merchant or owner can pause");
		});
		it('reverts if not a token contract', async () => {
			await expectRevert(
				this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, merchantUser, 36, 0, {from: merchantUser}),
				"ERC20 token not compatible");
		});
		it('reverts if 0 default periods', async () => {
			await expectRevert(
				this.app.createNewOrder(chargeCustomerPerInterval,  extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 0, 0, {from: merchantUser}),
				"Default number of intervals must be above 0");
		});
	});

	describe('try to accept offer', () => {
		beforeEach(async () => {
			await this.app.setNowOverride(2);
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, {from: merchantUser});

			// The customer needs to approve this
			await this.erc20.approve(this.app.address, 37 * chargeCustomerPerInterval, {from: customerUser}); // Approve 36 cycles of token transfers + 1st
		});

		it('Customer accepts the offer', async () => {

			await this.app.setNowOverride(3);
			const {receipt} = await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			await expectEvent(receipt, 'OrderAccepted', {
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser,
				startTime: (new BN(3)),
				extraBudgetPerInterval: (new BN(extraBudgetCustomerPerInterval)),
				approvedPeriodsRemaining: (new BN(36)),
			});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			const { customerId, customerAddress , extraBudgetPerInterval, extraBudgetUsed, extraBudgetLifetime, approvedPeriodsRemaining, firstPaymentMadeTimestamp, numberOfIntervalsPaid, terminated, amountPaidToDate} = await this.app.getCustomerOrder(0, customerIdBytes32);
			expect(customerAddress).to.be.equal(customerUser);
			expect(customerId).to.be.equal(customerIdBytes32);
			expect(extraBudgetPerInterval).to.be.bignumber.equal(new BN(extraBudgetCustomerPerInterval));
			expect(extraBudgetUsed).to.be.bignumber.equal(new BN(0));
			expect(extraBudgetLifetime).to.be.bignumber.equal(new BN(0));
			expect(approvedPeriodsRemaining).to.be.bignumber.equal(new BN(36));
			expect(firstPaymentMadeTimestamp).to.be.bignumber.equal(new BN(3));
			expect(numberOfIntervalsPaid).to.be.bignumber.equal(new BN(1));
			expect(terminated).to.be.equal(false);
			expect(amountPaidToDate).to.be.bignumber.equal(new BN(chargeCustomerPerInterval));

			const { timestamp, amount, feePercentage } = await this.app.getPaymentHistoryEntry(0, customerIdBytes32, 0);
			expect(timestamp).to.be.bignumber.equal(new BN(3));
			expect(amount).to.be.bignumber.equal(new BN(chargeCustomerPerInterval));
			expect(feePercentage).to.be.bignumber.equal(new BN(platformFee));
		});

		it('Customer accepts the offer but insufficient allowance', async () => {
			await this.app.setNowOverride(3);
			await this.erc20.approve(this.app.address, 0, {from: customerUser}); // 0 approval
			await expectRevert(
				this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser}),
				"Insufficient erc20 allowance"
			);
		});

		it('Customer accepts the offer but insufficient balance', async () => {
			await this.app.setNowOverride(3);
			await this.erc20.transfer(admin, 100000000, {from: customerUser}); // Send back all my balance
			await expectRevert(
				this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser}),
				"Insufficient balance first month"
			);
		});

		it('Customer accepts the offer custom cycle amount of 24', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 24, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			const { customerId, customerAddress, extraBudgetPerInterval, extraBudgetUsed, extraBudgetLifetime, approvedPeriodsRemaining, firstPaymentMadeTimestamp, numberOfIntervalsPaid, terminated, amountPaidToDate} = await this.app.getCustomerOrder(0, customerIdBytes32);
			expect(customerAddress).to.be.equal(customerUser);
			expect(customerId).to.be.equal(customerIdBytes32);
			expect(extraBudgetPerInterval).to.be.bignumber.equal(new BN(extraBudgetCustomerPerInterval));
			expect(extraBudgetUsed).to.be.bignumber.equal(new BN(0));
			expect(extraBudgetLifetime).to.be.bignumber.equal(new BN(0));
			expect(approvedPeriodsRemaining).to.be.bignumber.equal(new BN(24));
			expect(firstPaymentMadeTimestamp).to.be.bignumber.equal(new BN(3));
			expect(numberOfIntervalsPaid).to.be.bignumber.equal(new BN(1));
			expect(terminated).to.be.equal(false);
			expect(amountPaidToDate).to.be.bignumber.equal(new BN(chargeCustomerPerInterval));
		});

		it('Customer accepts the offer and gets first payment charged', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// One month later will be about 2678400 seconds
			await this.app.setNowOverride(2678403);
			const {receipt} = await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});
			await expectEvent(receipt, 'OrderPaidOut', {
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				amount: new BN(chargeCustomerPerInterval),
				feeAmount: new BN(chargeCustomerPerInterval * 0.05),
				timestamp: new BN('2678403'),
				executor: merchantUser,
			});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2));
		});

		it('Customer accepts the offer and the payment fee is changed', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			let {receipt} = await this.app.setMerchantSpecificPlatformFee(merchantUser, 40, true);
			await expectEvent(receipt, 'SetMerchantSpecificPlatformFee', {
				merchant: merchantUser,
				customPlatformFee: (new BN('40')),
				activated: true,
			});

			const ownerShareNew = chargeCustomerPerInterval * (40 / 1000);
			const merchantShareNew = chargeCustomerPerInterval - ownerShareNew;

			// Customer accepted order at timestamp 3.
			// One month later will be about 2678400 seconds
			await this.app.setNowOverride(2678403);
			receipt = await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});
			await expectEvent(receipt, 'OrderPaidOut', {
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				amount: new BN(chargeCustomerPerInterval),
				feeAmount: new BN(chargeCustomerPerInterval * 0.04), // custom set
				timestamp: new BN('2678403'),
				executor: merchantUser,
			});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare + ownerShareNew));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare + merchantShareNew));
		});

		it('Customer accepts the offer and the payment fee is changed and then changed back', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			let {receipt} = await this.app.setMerchantSpecificPlatformFee(merchantUser, 40, true);
			await expectEvent(receipt, 'SetMerchantSpecificPlatformFee', {
				merchant: merchantUser,
				customPlatformFee: (new BN('40')),
				activated: true,
			});

			receipt = await this.app.setMerchantSpecificPlatformFee(merchantUser, 0, false);
			await expectEvent(receipt, 'SetMerchantSpecificPlatformFee', {
				merchant: merchantUser,
				customPlatformFee: (new BN('0')), // irrelevant
				activated: false ,
			});

			// Customer accepted order at timestamp 3.
			// One month later will be about 2678400 seconds
			await this.app.setNowOverride(2678403);
			receipt = await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});
			await expectEvent(receipt, 'OrderPaidOut', {
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				amount: new BN(chargeCustomerPerInterval),
				feeAmount: new BN(chargeCustomerPerInterval * 0.05), // custom set
				timestamp: new BN('2678403'),
				executor: merchantUser,
			});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2));
		});

		it('Sends nothing if the month has not elapsed', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// One month later will be about 2678400 seconds
			await this.app.setNowOverride(2600000);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			// no change in balance
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));
		});

		it('Sends ten times if ten month has elapsed', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			// no change in balance
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 11));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 11));
		});

		it('If 40 months elapsed, only send for the approved 36 months', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 40
			await this.app.setNowOverride(107136003);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			// no change in balance
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 37)); // 36 months plus first month pay
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 37));
		});

		it('Cancels the order and renders it not payable', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			let {receipt} = await this.app.customerCancelOrder(0, customerIdBytes32, {from:customerUser});
			await expectEvent(receipt, 'OrderCancelled', {
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser
			});
			receipt = await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});
			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "This payment has been cancelled",
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser
			});
		});
		it('Cannot cancel order by random account', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			await expectRevert(
				this.app.customerCancelOrder(0, customerUser, {from:anotherAccount}),
				"Only the customer, merchant, or owner can cancel an order"
			);
		});

		it('Cancels the order and renews it', async () => {
			await this.erc20.approve(this.app.address, 50 * chargeCustomerPerInterval, {from: customerUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			await this.app.customerCancelOrder(0, customerIdBytes32, {from:customerUser});
			let {receipt} = await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});
			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "This payment has been cancelled",
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser
			});

			// 2 month later renew membership
			await this.app.setNowOverride(53568000);
			receipt = await this.app.customerRenewOrder(0, customerIdBytes32, 0,0, {from: customerUser});
			await expectEvent(receipt, 'OrderRenewed', {
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser,
				startTime: (new BN('53568000')),
				approvedPeriodsRemaining: (new BN(36)),
				orderRenewedNotExtended: true,
			});

			// First payment was made again at this point
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2));

			// Go through 36 more months
			await this.app.setNowOverride(1210636800);

			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 38));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 38));
		});

		it('Cancel order and renew but insufficient allowance', async () => {
			await this.erc20.approve(this.app.address, 50 * chargeCustomerPerInterval, {from: customerUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			await this.app.customerCancelOrder(0, customerIdBytes32, {from:customerUser});
			const {receipt} = await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});
			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "This payment has been cancelled",
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser
			});

			// 2 month later renew membership
			await this.app.setNowOverride(53568000);
			await this.erc20.approve(this.app.address, 0, {from: customerUser}); // 0 approval
			await expectRevert(
				this.app.customerRenewOrder(0, customerIdBytes32, 0, 0, {from: customerUser}),
				"Insufficient erc20 allowance"
			);
		});

		it('Cancel order and renew but insufficient balance', async () => {
			await this.erc20.approve(this.app.address, 50 * chargeCustomerPerInterval, {from: customerUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			await this.app.customerCancelOrder(0, customerIdBytes32, {from:customerUser});
			const {receipt} = await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});
			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "This payment has been cancelled",
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser
			});

			// 2 month later renew membership
			await this.app.setNowOverride(53568000);
			await this.erc20.transfer(admin, 100000000 - chargeCustomerPerInterval, {from: customerUser}); // Send back all my balance
			await expectRevert(
				this.app.customerRenewOrder(0, customerIdBytes32, 0, 0, {from: customerUser}),
				"Insufficient balance"
			);
		});

		it('Just extends the order', async () => {
			await this.erc20.approve(this.app.address, 80 * chargeCustomerPerInterval, {from: customerUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 40
			await this.app.setNowOverride(107136003);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			// no change in balance
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 37)); // 36 months plus first month pay
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 37));

			// 4 months over due and we are going to renew 36 more months on top.

			const {receipt} = await this.app.customerRenewOrder(0, customerIdBytes32, 0, 36, {from: customerUser});
			await expectEvent(receipt, 'OrderRenewed', {
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser,
				startTime: (new BN('3')),
				approvedPeriodsRemaining: (new BN(36)),
				orderRenewedNotExtended: false,
			});
			await this.app.setNowOverride(964224000);

			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 73));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 73));
		});

		it('Just extends the order, assure that without the payment in between same balance is gotten from extend in final payment', async () => {
			await this.erc20.approve(this.app.address, 80 * chargeCustomerPerInterval, {from: customerUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 40
			await this.app.setNowOverride(107136003);

			await this.app.customerRenewOrder(0, customerIdBytes32, 0, 36, {from: customerUser});

			await this.app.setNowOverride(964224000);

			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 73));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 73));
		});
	});
	describe('handle biweekly, weekly, and daily payments', () => {
		beforeEach(async () => {
			await this.app.setNowOverride(2);
			// The customer needs to approve this
			await this.erc20.approve(this.app.address, 37 * chargeCustomerPerInterval, {from: customerUser}); // Approve 36 cycles of token transfers + 1st
		});

		it('Sends biweekly', async () => {
			const biweekly = 4;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, biweekly, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// First biweekly payment after 14 days
			await this.app.setNowOverride(1209603);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2));

			// 14 days more
			await this.app.setNowOverride(2419203);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 3));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 3));
		});

		it('Sends weekly', async () => {
			const weekly = 5;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, weekly, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// First weekly payment after 7 days
			await this.app.setNowOverride(604803);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2));

			// 14 days in
			await this.app.setNowOverride(1209603);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 3));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 3));
		});

		it('Sends daily', async () => {
			const daily = 6;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, daily, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 days (7 cycles)
			await this.app.setNowOverride(604803);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 days in
			await this.app.setNowOverride(1209603);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends hourly', async () => {
			const hourly = 7;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, hourly, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 hours (7 cycles)
			await this.app.setNowOverride(25203);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 hours in
			await this.app.setNowOverride(50403);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends by minute', async () => {
			const minute = 8;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, minute, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 minutes (7 cycles)
			await this.app.setNowOverride(423);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 minutes in
			await this.app.setNowOverride(843);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends by second', async () => {
			const second = 9;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, second, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 seconds (7 cycles)
			await this.app.setNowOverride(10);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 seconds in
			await this.app.setNowOverride(17);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Test the trial with period in seconds and test how many intervals to pay', async () => {
			const second = 9;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, second, this.erc20.address, 36, 8, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN('0'));//free
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN('0'));//free


			// Payment after 5 seconds (5 cycles)
			await this.app.setNowOverride(5);

			const payable = await this.app.howManyIntervalsToPayExternal(0, customerIdBytes32);
			expect(payable).to.be.bignumber.equal(new BN('2'));

			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});


			// Payment after 7 seconds (7 cycles)
			await this.app.setNowOverride(10);

			const payable2 = await this.app.howManyIntervalsToPayExternal(0, customerIdBytes32);
			expect(payable2).to.be.bignumber.equal(new BN('5'));

			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN('0'));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN('0'));

			// 14 seconds in
			await this.app.setNowOverride(17);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 7));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 7));
		});
		it('Test the trial with period in seconds with gas saving mode', async () => {
			const second = 9;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, second, this.erc20.address, 36, 8, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN('0'));//free
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN('0'));//free

			// Payment after 7 seconds (7 cycles)
			await this.app.setNowOverride(10);
			await this.app.batchProcessPayment([0],[customerIdBytes32], true, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN('0'));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN('0'));

			// 14 seconds in
			await this.app.setNowOverride(17);
			await this.app.batchProcessPayment([0],[customerIdBytes32], true, [0], {from:merchantUser});

			await this.app.withdraw(this.erc20.address, {from: merchantUser});
			await this.app.withdraw(this.erc20.address, {from: admin});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 7));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 7));
		});

		it('Sends yearly', async () => {
			const yearly = 0;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, yearly, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 years (7 cycles)
			await this.app.setNowOverride(224985603);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 years in
			await this.app.setNowOverride(449971203);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends semi-yearly', async () => {
			const semiyearly = 1;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, semiyearly, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 years (7 cycles)
			await this.app.setNowOverride(112492800);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 years in
			await this.app.setNowOverride(224985603);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends quarter-yearly', async () => {
			const quarteryearly = 2;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, quarteryearly, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 years (7 cycles)
			await this.app.setNowOverride(56246403);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 years in
			await this.app.setNowOverride(112492800);
			await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Call payment but insufficient allowance', async () => {
			const quarteryearly = 2;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, quarteryearly, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			await this.app.setNowOverride(56246403);
			await this.erc20.approve(this.app.address, 0, {from: customerUser}); // 0 approval
			const {receipt} = await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "Insufficient erc20 allowance",
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser
			});
		});

		it('Call payment but insufficient balance', async () => {
			const quarteryearly = 2;
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, quarteryearly, this.erc20.address, 36, 0, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			await this.app.setNowOverride(56246403);
			await this.erc20.transfer(admin, 100000000 - chargeCustomerPerInterval, {from: customerUser}); // Send back all my balance

			const {receipt} = await this.app.batchProcessPayment([0],[customerIdBytes32], false, [0], {from:merchantUser});

			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "Insufficient balance",
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser
			});
		});
	});

	describe('Stress test to see how many can handle', () => {
		beforeEach(async () => {
			await this.app.setNowOverride(2);
			// The customer needs to approve this
			await this.erc20.approve(this.app.address, 1000000000, {from: customerUser}); // Approve 36 cycles of token transfers + 1st

		});

		it('Tests sending many payments', async () => {
			const howManyPayments = 10; // 170 works -- keep low to run test in reasonable time
			const smallPayment = 100000;
			const enoughWeiToMakeTx = howManyPayments * smallPayment * 10000;// could be reduced (todo)
			this.erc20 = await GLDToken.new(enoughWeiToMakeTx, {from: admin}); // 100 million wei of gold
			await this.erc20.transfer(customerUser, enoughWeiToMakeTx, {from: admin}); // 100 million wei of gold, transfer all to customer
			await this.erc20.approve(this.app.address, enoughWeiToMakeTx, {from: customerUser}); // Approve 36 cycles of token transfers + 1st

			for(let i=0; i<howManyPayments;i++) {
				await this.app.createNewOrder(smallPayment, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, {from: merchantUser}); // 100,000 wei
			}
			await this.app.setNowOverride(3);
			let customerIdsBytes32Array  = [];
			for(let i=0; i<howManyPayments;i++) {
				const customerIdWithI = `customer${i}`;
				const customerIdBytes32Dynamic = stringToBytes32(customerIdWithI);
				customerIdsBytes32Array.push(customerIdBytes32Dynamic);
				await this.app.customerAcceptOrder(i, customerIdBytes32Dynamic, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			}
			await this.app.setNowOverride(2678403);

			await this.app.batchProcessPayment([...Array(howManyPayments).keys()],customerIdsBytes32Array, false, Array(howManyPayments).fill(0), {from:merchantUser});

			const ownerShare = smallPayment * (platformFee / 1000);
			const merchantShare = smallPayment - ownerShare;
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2 * howManyPayments ));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2 * howManyPayments));
		});
		it('Tests sending many payments with gas savings', async () => {
			const howManyPayments = 20; // 170 works -- keep low to run test in reasonable time
			const smallPayment = 100000;
			const enoughWeiToMakeTx = howManyPayments * smallPayment * 10000;// could be reduced (todo)
			this.erc20 = await GLDToken.new(enoughWeiToMakeTx, {from: admin}); // 100 million wei of gold
			await this.erc20.transfer(customerUser, enoughWeiToMakeTx, {from: admin}); // 100 million wei of gold, transfer all to customer
			await this.erc20.approve(this.app.address, enoughWeiToMakeTx, {from: customerUser}); // Approve 36 cycles of token transfers + 1st

			for(let i=0; i<howManyPayments;i++) {
				await this.app.createNewOrder(smallPayment, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, {from: merchantUser}); // 100,000 wei
			}
			await this.app.setNowOverride(3);
			let customerIdsBytes32Array  = [];
			for(let i=0; i<howManyPayments;i++) {
				const customerIdWithI = `customer${i}`;
				const customerIdBytes32Dynamic = stringToBytes32(customerIdWithI);
				customerIdsBytes32Array.push(customerIdBytes32Dynamic);
				await this.app.customerAcceptOrder(i, customerIdBytes32Dynamic, extraBudgetCustomerPerInterval, 0, {from: customerUser});
			}
			await this.app.setNowOverride(2678403);

			await this.app.batchProcessPayment([...Array(howManyPayments).keys()],customerIdsBytes32Array, true, Array(howManyPayments).fill(0), {from:merchantUser});

			const ownerShare = smallPayment * (platformFee / 1000);
			const merchantShare = smallPayment - ownerShare;


			expect(await this.erc20.balanceOf(this.app.address)).to.be.bignumber.equal(new BN((merchantShare + ownerShare) * 1 * howManyPayments));

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 1 * howManyPayments ));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 1 * howManyPayments));

			await this.app.withdraw(this.erc20.address, {from: admin});
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(2 * (ownerShare * howManyPayments)));

			await this.app.withdrawBatch([this.erc20.address], {from: merchantUser});
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(2 * (merchantShare * howManyPayments)));
		});

	});

	// Extra budget payments
	describe('Flex Budget Tests', () => {
		beforeEach(async () => {
			await this.app.setNowOverride(2);
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, { from: merchantUser });
			await this.erc20.approve(this.app.address, 37 * chargeCustomerPerInterval, { from: customerUser }); // Approve 36 cycles of token transfers + 1st
		});

		it('Customer accepts order with non-zero extra budget per interval', async () => {
			await this.app.setNowOverride(3);

			// Balance checks before the order is accepted
			let customerBalanceBefore = await this.erc20.balanceOf(customerUser);
			let adminBalanceBefore = await this.erc20.balanceOf(admin);
			let merchantBalanceBefore = await this.erc20.balanceOf(merchantUser);
			let contractBalanceBefore = await this.erc20.balanceOf(this.app.address);

			const { receipt } = await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });
			await expectEvent(receipt, 'OrderAccepted', {
				orderId: new BN('0'),
				customerId: customerIdBytes32,
				customerAddress: customerUser,
				startTime: new BN(3),
				extraBudgetPerInterval: new BN(extraBudgetCustomerPerInterval),
				approvedPeriodsRemaining: new BN(36),
			});

			// Balance checks after the order is accepted
			let customerBalanceAfter = await this.erc20.balanceOf(customerUser);
			let adminBalanceAfter = await this.erc20.balanceOf(admin);
			let merchantBalanceAfter = await this.erc20.balanceOf(merchantUser);
			let contractBalanceAfter = await this.erc20.balanceOf(this.app.address);

			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(customerBalanceAfter).to.be.bignumber.equal(customerBalanceBefore.sub(new BN(chargeCustomerPerInterval)));
			expect(adminBalanceAfter).to.be.bignumber.equal(adminBalanceBefore.add(new BN(ownerShare)));
			expect(merchantBalanceAfter).to.be.bignumber.equal(merchantBalanceBefore.add(new BN(merchantShare)));
			expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore);
		});

		it('Processes payment with extra budget correctly', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);

			// Balance checks before payment processing
			let customerBalanceBefore = await this.erc20.balanceOf(customerUser);
			let adminBalanceBefore = await this.erc20.balanceOf(admin);
			let merchantBalanceBefore = await this.erc20.balanceOf(merchantUser);
			let contractBalanceBefore = await this.erc20.balanceOf(this.app.address);

			const { receipt } = await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });
			await expectEvent(receipt, 'OrderPaidOut', {
				orderId: new BN('0'),
				customerId: customerIdBytes32,
				amount: new BN(chargeCustomerPerInterval),
				feeAmount: new BN(chargeCustomerPerInterval * 0.05),
				timestamp: new BN('2678403'),
				executor: merchantUser,
			});

			// Balance checks after payment processing
			let customerBalanceAfter = await this.erc20.balanceOf(customerUser);
			let adminBalanceAfter = await this.erc20.balanceOf(admin);
			let merchantBalanceAfter = await this.erc20.balanceOf(merchantUser);
			let contractBalanceAfter = await this.erc20.balanceOf(this.app.address);

			const extraPaymentEvents = receipt.logs.filter(log => log.event === 'ExtraBudgetLogged');
			expect(extraPaymentEvents.length).to.equal(1);
			const extraPaymentEvent = extraPaymentEvents[0];
			expect(extraPaymentEvent.args.extraAmount).to.be.bignumber.equal(new BN(extraAmount));

			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(adminBalanceAfter).to.be.bignumber.equal(adminBalanceBefore.add(new BN(ownerShare)));
			expect(merchantBalanceAfter).to.be.bignumber.equal(merchantBalanceBefore.add(new BN(merchantShare)));
			expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.add(new BN(extraAmount)));
		});

		it('Processes payment with extra budget in gas savings mode', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);

			// Balance checks before payment processing
			let customerBalanceBefore = await this.erc20.balanceOf(customerUser);
			let adminBalanceBefore = await this.erc20.balanceOf(admin);
			let merchantBalanceBefore = await this.erc20.balanceOf(merchantUser);
			let contractBalanceBefore = await this.erc20.balanceOf(this.app.address);

			const { receipt } = await this.app.batchProcessPayment([0], [customerIdBytes32], true, [extraAmount], { from: merchantUser });
			await expectEvent(receipt, 'OrderPaidOutGasSavingMode', {
				orderId: new BN('0'),
				customerId: customerIdBytes32,
				amount: new BN(chargeCustomerPerInterval),
				feeAmount: new BN(chargeCustomerPerInterval * 0.05),
				timestamp: new BN('2678403'),
				executor: merchantUser,
			});

			// Balance checks after payment processing
			let customerBalanceAfter = await this.erc20.balanceOf(customerUser);
			let adminBalanceAfter = await this.erc20.balanceOf(admin);
			let merchantBalanceAfter = await this.erc20.balanceOf(merchantUser);
			let contractBalanceAfter = await this.erc20.balanceOf(this.app.address);

			const extraPaymentEvents = receipt.logs.filter(log => log.event === 'ExtraBudgetLogged');
			expect(extraPaymentEvents.length).to.equal(1);
			const extraPaymentEvent = extraPaymentEvents[0];
			expect(extraPaymentEvent.args.extraAmount).to.be.bignumber.equal(new BN(extraAmount));

			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(adminBalanceAfter).to.be.bignumber.equal(adminBalanceBefore);
			expect(merchantBalanceAfter).to.be.bignumber.equal(merchantBalanceBefore);
			expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.add(new BN(chargeCustomerPerInterval + extraAmount)));

			await this.app.withdraw(this.erc20.address, { from: admin });
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2));

			await this.app.withdrawBatch([this.erc20.address], { from: merchantUser });
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2));
		});

		it('Processes payment with extra budget in gas savings mode and test the manual user withdrawForUser and owner emergency withdraw', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);

			// Balance checks before payment processing
			let customerBalanceBefore = await this.erc20.balanceOf(customerUser);
			let adminBalanceBefore = await this.erc20.balanceOf(admin);
			let merchantBalanceBefore = await this.erc20.balanceOf(merchantUser);
			let contractBalanceBefore = await this.erc20.balanceOf(this.app.address);

			const { receipt } = await this.app.batchProcessPayment([0], [customerIdBytes32], true, [extraAmount], { from: merchantUser });
			await expectEvent(receipt, 'OrderPaidOutGasSavingMode', {
				orderId: new BN('0'),
				customerId: customerIdBytes32,
				amount: new BN(chargeCustomerPerInterval),
				feeAmount: new BN(chargeCustomerPerInterval * 0.05),
				timestamp: new BN('2678403'),
				executor: merchantUser,
			});

			// Balance checks after payment processing
			let customerBalanceAfter = await this.erc20.balanceOf(customerUser);
			let adminBalanceAfter = await this.erc20.balanceOf(admin);
			let merchantBalanceAfter = await this.erc20.balanceOf(merchantUser);
			let contractBalanceAfter = await this.erc20.balanceOf(this.app.address);

			const extraPaymentEvents = receipt.logs.filter(log => log.event === 'ExtraBudgetLogged');
			expect(extraPaymentEvents.length).to.equal(1);
			const extraPaymentEvent = extraPaymentEvents[0];
			expect(extraPaymentEvent.args.extraAmount).to.be.bignumber.equal(new BN(extraAmount));

			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(adminBalanceAfter).to.be.bignumber.equal(adminBalanceBefore);
			expect(merchantBalanceAfter).to.be.bignumber.equal(merchantBalanceBefore);
			expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.add(new BN(chargeCustomerPerInterval + extraAmount)));

			await this.app.ownerEmergencyRecover(ownerShare, this.erc20.address, { from: admin });
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2));

			await this.app.withdrawForUser(merchantUser, this.erc20.address, { from: merchantUser });
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2));
		});

		it('Processes payment with extra budget in gas savings mode but fails', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);

			// Balance checks before payment processing
			let customerBalanceBefore = await this.erc20.balanceOf(customerUser);
			let adminBalanceBefore = await this.erc20.balanceOf(admin);
			let merchantBalanceBefore = await this.erc20.balanceOf(merchantUser);
			let contractBalanceBefore = await this.erc20.balanceOf(this.app.address);

			await this.erc20.approve(this.app.address, 0, {from: customerUser}); // Approve 36 cycles of token transfers + 1st
			const { receipt } = await this.app.batchProcessPayment([0], [customerIdBytes32], true, [extraAmount], { from: merchantUser });

			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "Insufficient erc20 allowance",
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser
			});
			// await expectEvent(receipt, 'OrderPaidOutGasSavingMode', {
			// 	orderId: new BN('0'),
			// 	customerId: customerIdBytes32,
			// 	amount: new BN(chargeCustomerPerInterval),
			// 	feeAmount: new BN(chargeCustomerPerInterval * 0.05),
			// 	timestamp: new BN('2678403'),
			// 	executor: merchantUser,
			// });

			// Balance checks after payment processing
			let customerBalanceAfter = await this.erc20.balanceOf(customerUser);
			let adminBalanceAfter = await this.erc20.balanceOf(admin);
			let merchantBalanceAfter = await this.erc20.balanceOf(merchantUser);
			let contractBalanceAfter = await this.erc20.balanceOf(this.app.address);

			// const extraPaymentEvents = receipt.logs.filter(log => log.event === 'ExtraBudgetLogged');
			// expect(extraPaymentEvents.length).to.equal(1);
			// const extraPaymentEvent = extraPaymentEvents[0];
			// expect(extraPaymentEvent.args.extraAmount).to.be.bignumber.equal(new BN(extraAmount));

			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(adminBalanceAfter).to.be.bignumber.equal(adminBalanceBefore);
			expect(merchantBalanceAfter).to.be.bignumber.equal(merchantBalanceBefore);
			expect(contractBalanceAfter).to.be.bignumber.equal(new BN('0'));

			await this.app.withdraw(this.erc20.address, { from: admin });
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN('50000'));

			await this.app.withdrawBatch([this.erc20.address], { from: merchantUser });
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN('950000'));
		});

		it('Processes payment with extra budget without gas savings mode but fails', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);

			// Balance checks before payment processing
			let customerBalanceBefore = await this.erc20.balanceOf(customerUser);
			let adminBalanceBefore = await this.erc20.balanceOf(admin);
			let merchantBalanceBefore = await this.erc20.balanceOf(merchantUser);
			let contractBalanceBefore = await this.erc20.balanceOf(this.app.address);

			await this.erc20.approve(this.app.address, 0, {from: customerUser}); // Approve 36 cycles of token transfers + 1st
			const { receipt } = await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });

			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "Insufficient erc20 allowance",
				orderId: (new BN('0')),
				customerId: customerIdBytes32,
				customerAddress: customerUser
			});
			// await expectEvent(receipt, 'OrderPaidOutGasSavingMode', {
			// 	orderId: new BN('0'),
			// 	customerId: customerIdBytes32,
			// 	amount: new BN(chargeCustomerPerInterval),
			// 	feeAmount: new BN(chargeCustomerPerInterval * 0.05),
			// 	timestamp: new BN('2678403'),
			// 	executor: merchantUser,
			// });

			// Balance checks after payment processing
			let customerBalanceAfter = await this.erc20.balanceOf(customerUser);
			let adminBalanceAfter = await this.erc20.balanceOf(admin);
			let merchantBalanceAfter = await this.erc20.balanceOf(merchantUser);
			let contractBalanceAfter = await this.erc20.balanceOf(this.app.address);

			// const extraPaymentEvents = receipt.logs.filter(log => log.event === 'ExtraBudgetLogged');
			// expect(extraPaymentEvents.length).to.equal(1);
			// const extraPaymentEvent = extraPaymentEvents[0];
			// expect(extraPaymentEvent.args.extraAmount).to.be.bignumber.equal(new BN(extraAmount));

			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(adminBalanceAfter).to.be.bignumber.equal(adminBalanceBefore);
			expect(merchantBalanceAfter).to.be.bignumber.equal(merchantBalanceBefore);
			expect(contractBalanceAfter).to.be.bignumber.equal(new BN('0'));

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN('50000'));

			await this.app.withdrawBatch([this.erc20.address], { from: merchantUser });
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN('950000'));
		});


		it('Refunds extra budget payment correctly', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);
			await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });

			await this.app.setNowOverride(2680000);

			// Balance checks before refund processing
			let customerBalanceBefore = await this.erc20.balanceOf(customerUser);
			let adminBalanceBefore = await this.erc20.balanceOf(admin);
			let merchantBalanceBefore = await this.erc20.balanceOf(merchantUser);
			let contractBalanceBefore = await this.erc20.balanceOf(this.app.address);

			const { receipt } = await this.app.refundPendingExtraPayment(0, 0, 0);
			await expectEvent(receipt, 'ExtraBudgetRefunded', {
				orderId: new BN('0'),
				customerId: customerIdBytes32,
				customerAddress: customerUser,
				extraAmount: new BN(extraAmount),
				index: new BN(0),
			});

			// Balance checks after refund processing
			let customerBalanceAfter = await this.erc20.balanceOf(customerUser);
			let adminBalanceAfter = await this.erc20.balanceOf(admin);
			let merchantBalanceAfter = await this.erc20.balanceOf(merchantUser);
			let contractBalanceAfter = await this.erc20.balanceOf(this.app.address);

			const expectedBalance = new BN(100000000 - (chargeCustomerPerInterval * 2));

			expect(customerBalanceAfter).to.be.bignumber.equal(expectedBalance);
			expect(adminBalanceAfter).to.be.bignumber.equal(adminBalanceBefore);
			expect(merchantBalanceAfter).to.be.bignumber.equal(merchantBalanceBefore);
			expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(new BN(extraAmount)));
		});

		it('Handles multiple extra budget payments', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);
			await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });
			await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });

			// Balance checks before refund processing
			let customerBalanceBefore = await this.erc20.balanceOf(customerUser);
			let adminBalanceBefore = await this.erc20.balanceOf(admin);
			let merchantBalanceBefore = await this.erc20.balanceOf(merchantUser);
			let contractBalanceBefore = await this.erc20.balanceOf(this.app.address);

			const { receipt } = await this.app.refundPendingExtraPayment(0, 0, 1);
			await expectEvent(receipt, 'ExtraBudgetRefunded', {
				orderId: new BN('0'),
				customerAddress: customerUser,
				customerId: customerIdBytes32,
				extraAmount: new BN(extraAmount),
				index: new BN(0),
			});
			await expectEvent(receipt, 'ExtraBudgetRefunded', {
				orderId: new BN('0'),
				customerAddress: customerUser,
				customerId: customerIdBytes32,
				extraAmount: new BN(extraAmount),
				index: new BN(1),
			});

			// Balance checks after refund processing
			let customerBalanceAfter = await this.erc20.balanceOf(customerUser);
			let adminBalanceAfter = await this.erc20.balanceOf(admin);
			let merchantBalanceAfter = await this.erc20.balanceOf(merchantUser);
			let contractBalanceAfter = await this.erc20.balanceOf(this.app.address);

			const expectedBalance = new BN(100000000 - (chargeCustomerPerInterval * 2));

			expect(customerBalanceAfter).to.be.bignumber.equal(expectedBalance);
			expect(adminBalanceAfter).to.be.bignumber.equal(adminBalanceBefore);
			expect(merchantBalanceAfter).to.be.bignumber.equal(merchantBalanceBefore);
			expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(new BN(extraAmount * 2)));
		});


		it('Processes pending extra budget payments correctly', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);
			await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });

			// Simulate waiting for the lock down period to pass
			await this.app.setNowOverride(2678403 + 604800); // added some extra time

			// Balance checks before processing pending payments
			let customerBalanceBefore = await this.erc20.balanceOf(customerUser);
			let adminBalanceBefore = await this.erc20.balanceOf(admin);
			let merchantBalanceBefore = await this.erc20.balanceOf(merchantUser);
			let contractBalanceBefore = await this.erc20.balanceOf(this.app.address);

			await this.app.processPendingPayments(0, 0, 0);

			// Balance checks after processing pending payments
			let customerBalanceAfter = await this.erc20.balanceOf(customerUser);
			let adminBalanceAfter = await this.erc20.balanceOf(admin);
			let merchantBalanceAfter = await this.erc20.balanceOf(merchantUser);
			let contractBalanceAfter = await this.erc20.balanceOf(this.app.address);

			const ownerShare = extraAmount * (platformFee / 1000);
			const merchantShare = extraAmount - ownerShare;

			expect(adminBalanceAfter).to.be.bignumber.equal(adminBalanceBefore.add(new BN(ownerShare)));
			expect(merchantBalanceAfter).to.be.bignumber.equal(merchantBalanceBefore.add(new BN(merchantShare)));
			expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(new BN(extraAmount)));
		});

		it('Fails to do the extra budget payment, extra budget requested is too high', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);

			const {receipt} = await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount * 100], { from: merchantUser });

			const failureEvents = receipt.logs.filter(log => log.event === 'PaymentFailure');
			expect(failureEvents.length).to.equal(1);
			const failureEvent = failureEvents[0];
			expect(failureEvent.args.orderId).to.be.bignumber.equal(new BN(0));
			expect(failureEvent.args.customerAddress).to.equal(customerUser);
			expect(failureEvent.args.customerId).to.equal(customerIdBytes32);
			expect(failureEvent.args.revertString).to.equal("Exceeds extra budget");

		});
		it('Fails to do the extra budget payment, extra budget requested is too high (with gas savings)', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);

			const {receipt} = await this.app.batchProcessPayment([0], [customerIdBytes32], true, [extraAmount * 100], { from: merchantUser });

			const failureEvents = receipt.logs.filter(log => log.event === 'PaymentFailure');
			expect(failureEvents.length).to.equal(1);
			const failureEvent = failureEvents[0];
			expect(failureEvent.args.orderId).to.be.bignumber.equal(new BN(0));
			expect(failureEvent.args.customerAddress).to.equal(customerUser);
			expect(failureEvent.args.customerId).to.equal(customerIdBytes32);
			expect(failureEvent.args.revertString).to.equal("Exceeds extra budget");

		});

		it('Handles multiple pending extra budget payments correctly', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);
			await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });
			await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });

			// Simulate waiting for the lock down period to pass
			await this.app.setNowOverride(2678403 + 604800);

			// Balance checks before processing pending payments
			let customerBalanceBefore = await this.erc20.balanceOf(customerUser);
			let adminBalanceBefore = await this.erc20.balanceOf(admin);
			let merchantBalanceBefore = await this.erc20.balanceOf(merchantUser);
			let contractBalanceBefore = await this.erc20.balanceOf(this.app.address);

			await this.app.processPendingPayments(0, 0, 1);

			// Balance checks after processing pending payments
			let customerBalanceAfter = await this.erc20.balanceOf(customerUser);
			let adminBalanceAfter = await this.erc20.balanceOf(admin);
			let merchantBalanceAfter = await this.erc20.balanceOf(merchantUser);
			let contractBalanceAfter = await this.erc20.balanceOf(this.app.address);

			const ownerShare = extraAmount * 2 * (platformFee / 1000);
			const merchantShare = (extraAmount * 2) - ownerShare;

			expect(adminBalanceAfter).to.be.bignumber.equal(adminBalanceBefore.add(new BN(ownerShare)));
			expect(merchantBalanceAfter).to.be.bignumber.equal(merchantBalanceBefore.add(new BN(merchantShare)));
			expect(contractBalanceAfter).to.be.bignumber.equal(contractBalanceBefore.sub(new BN(extraAmount * 2)));
		});

		it('Fails when orderId is invalid in processPendingPayments', async () => {
			await expectRevert(
				this.app.processPendingPayments(999, 0, 1), // invalid orderId
				'Invalid order ID'
			);
		});

		it('Fails when endPaymentIndex is less than or equal to startPaymentIndex in processPendingPayments', async () => {
			await expectRevert(
				this.app.processPendingPayments(0, 1, 1), // endPaymentIndex is equal to startPaymentIndex
				'End index must be zero or greater than start index'
			);
		});


		it('Fails when orderId is invalid in refundPendingExtraPayment', async () => {
			await expectRevert(
				this.app.refundPendingExtraPayment(999, 0, 0), // invalid orderId
				'Invalid order ID'
			);
		});

		it('Fails when endRefundIndex is less than or equal to startRefundIndex in refundPendingExtraPayment', async () => {
			await expectRevert(
				this.app.refundPendingExtraPayment(0, 2, 1), // endRefundIndex is equal to startRefundIndex
				'End index must be zero or greater than start index'
			);
		});

		it('Handles payment failure due to insufficient approval', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);

			// Reduce the approval amount to simulate insufficient approval
			await this.erc20.approve(this.app.address, 0, { from: customerUser });

			const { receipt } = await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });

			// Expect a PaymentFailure event
			const failureEvents = receipt.logs.filter(log => log.event === 'PaymentFailure');
			expect(failureEvents.length).to.equal(1);
			const failureEvent = failureEvents[0];
			expect(failureEvent.args.orderId).to.be.bignumber.equal(new BN(0));
			expect(failureEvent.args.customerId).to.equal(customerIdBytes32);
			expect(failureEvent.args.customerAddress).to.equal(customerUser);
			expect(failureEvent.args.revertString).to.equal("Insufficient erc20 allowance");
		});

		it('Handles payment failure due to terminated customer order', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);
			await this.app.customerCancelOrder(0, customerIdBytes32);

			const { receipt } = await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });

			// Expect a PaymentFailure event
			const failureEvents = receipt.logs.filter(log => log.event === 'PaymentFailure');
			expect(failureEvents.length).to.equal(1);
			const failureEvent = failureEvents[0];
			expect(failureEvent.args.orderId).to.be.bignumber.equal(new BN(0));
			expect(failureEvent.args.customerAddress).to.equal(customerUser);
			expect(failureEvent.args.customerId).to.equal(customerIdBytes32);
			expect(failureEvent.args.revertString).to.equal("This payment has been cancelled");
		});

		it('Handles payment failure due to paused order', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);
			await this.app.setOrderPauseState(0, true, { from: merchantUser });

			const { receipt } = await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });

			// Expect a PaymentFailure event
			const failureEvents = receipt.logs.filter(log => log.event === 'PaymentFailure');
			expect(failureEvents.length).to.equal(1);
			const failureEvent = failureEvents[0];
			expect(failureEvent.args.orderId).to.be.bignumber.equal(new BN(0));
			expect(failureEvent.args.customerAddress).to.equal(customerUser);
			expect(failureEvent.args.customerId).to.equal(customerIdBytes32);
			expect(failureEvent.args.revertString).to.equal("Cannot process, this order is paused");
		});

		it('Handles payment failure due to transfer failure (insufficient balance)', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);

			// Simulate transfer failure by reducing balance
			await this.erc20.transfer(admin, await this.erc20.balanceOf(customerUser), { from: customerUser });

			const { receipt } = await this.app.batchProcessPayment([0], [customerIdBytes32], false, [extraAmount], { from: merchantUser });

			// Expect a PaymentFailure event
			const failureEvents = receipt.logs.filter(log => log.event === 'PaymentFailure');
			expect(failureEvents.length).to.equal(1);
			const failureEvent = failureEvents[0];
			expect(failureEvent.args.orderId).to.be.bignumber.equal(new BN(0));
			expect(failureEvent.args.customerAddress).to.equal(customerUser);
			expect(failureEvent.args.customerId).to.equal(customerIdBytes32);
			expect(failureEvent.args.revertString).to.equal("Insufficient balance");
		});

		it('Processes successful payments and handles failures in the same batch', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, customerIdBytes32, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			await this.app.setNowOverride(2678403);

			// send more tokens
			//this.erc20 = await GLDToken.new(100000000, {from: admin}); // 100 million wei of gold
			//await this.erc20.transfer(customerUser, 100000000, {from: admin}); // 100 million wei of gold, transfer all to customer

			// Create another order for a different customer
			await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, { from: merchantUser });
			await this.erc20.approve(this.app.address, 37 * chargeCustomerPerInterval, { from: customerUser }); // Approve 36 cycles of token transfers + 1st for the second customer
			await this.app.customerAcceptOrder(1, customerIdBytes32V2, extraBudgetCustomerPerInterval, 0, { from: customerUser });

			// Simulate transfer failure for the first customer by reducing balance
			const customerBalance = await this.erc20.balanceOf(customerUser);
			const adminBalance = await this.erc20.balanceOf(admin);
			console.log('Initial customer balance:', customerBalance.toString());
			console.log('Initial admin balance:', adminBalance.toString());

			const reduceAmount = customerBalance.sub(new BN(extraAmount)); // Keep enough for one successful and one failed payment
			console.log('reduce amount is:');
			console.log(reduceAmount);
			await this.erc20.transfer(admin, reduceAmount, { from: customerUser });

			// Verify balances after transfer
			const customerBalanceAfterTransfer = await this.erc20.balanceOf(customerUser);
			const adminBalanceAfterTransfer = await this.erc20.balanceOf(admin);
			console.log('Customer balance after transfer:', customerBalanceAfterTransfer.toString());
			console.log('Admin balance after transfer:', adminBalanceAfterTransfer.toString());

			// Log approvals
			const customerAllowance = await this.erc20.allowance(customerUser, this.app.address);
			const adminAllowance = await this.erc20.allowance(admin, this.app.address);
			console.log('Customer allowance for contract:', customerAllowance.toString());
			console.log('Admin allowance for contract:', adminAllowance.toString());

			// Process payments
			const { receipt } = await this.app.batchProcessPayment([0, 1], [customerIdBytes32, customerIdBytes32V2], false, [extraAmount, extraAmount], { from: merchantUser });

			// Verify balances after payment processing
			const customerBalanceAfterPayment = await this.erc20.balanceOf(customerUser);
			const adminBalanceAfterPayment = await this.erc20.balanceOf(admin);
			const merchantBalance = await this.erc20.balanceOf(merchantUser);
			const ownerBalance = await this.erc20.balanceOf(admin);
			console.log('Customer balance after payment:', customerBalanceAfterPayment.toString());
			console.log('Admin balance after payment:', adminBalanceAfterPayment.toString());
			console.log('Merchant balance:', merchantBalance.toString());
			console.log('Owner balance:', ownerBalance.toString());

			// Expect a PaymentFailure event for the first customer
			const failureEvents = receipt.logs.filter(log => log.event === 'PaymentFailure');
			expect(failureEvents.length).to.equal(1);
			const failureEvent = failureEvents[0];
			expect(failureEvent.args.orderId).to.be.bignumber.equal(new BN(0));
			expect(failureEvent.args.customerAddress).to.equal(customerUser);
			expect(failureEvent.args.customerId).to.equal(customerIdBytes32);
			expect(failureEvent.args.revertString).to.equal("Insufficient balance");

			// Expect a SuccessfulPay event for the second customer
			const successEvents = receipt.logs.filter(log => log.event === 'SuccessfulPay');
			expect(successEvents.length).to.equal(1);
			const successEvent = successEvents[0];
			expect(successEvent.args.orderId).to.be.bignumber.equal(new BN(1));
			expect(successEvent.args.customerId).to.equal(customerIdBytes32V2);
			expect(successEvent.args.customerAddress).to.equal(customerUser);
		});

	it('Customer accepts three orders with different ids and processes them with one having extra charge', async () => {
		await this.app.setNowOverride(1);
		// await this.app.createNewOrder(chargeCustomerPerInterval, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, { from: merchantUser });
		// await this.erc20.approve(this.app.address, 3 * (37 * chargeCustomerPerInterval), { from: customerUser }); // Approve 36 cycles of token transfers + 1st for all 3 orders

		await this.app.setNowOverride(2);

		// Customer accepts the orders
		const orderIds = [0, 0, 0];
		const customerIds = [stringToBytes32("customerOrder1"), stringToBytes32("customerOrder2"), stringToBytes32("customerOrder3")];

		for (let i = 0; i < orderIds.length; i++) {
			await this.app.customerAcceptOrder(orderIds[i], customerIds[i], extraBudgetCustomerPerInterval, 0, { from: customerUser });
		}

		await this.app.setNowOverride(2678403); // Move time forward to process payments

		// Batch process the orders with an extra charge on the third one
		const { receipt } = await this.app.batchProcessPayment([0, 0, 0], customerIds, false, [0, extraAmount, extraAmount], { from: merchantUser });
	 //	const { receipt } = await this.app.batchProcessPayment([0, 0, 0], customerIds, false, [0, 0, 0], { from: merchantUser });
	//
		for (let i = 0; i < orderIds.length; i++) {
			await expectEvent(receipt, 'OrderPaidOut', {
				orderId: new BN(orderIds[i]),
				customerId: customerIds[i],
				amount: new BN(chargeCustomerPerInterval),
				feeAmount: new BN(chargeCustomerPerInterval * 0.05),
				timestamp: new BN('2678403'),
				executor: merchantUser,
			});
		}
	//
	// 	// Withdraw funds
	 	await this.app.setNowOverride(5356800); // Move time forward to allow withdrawal
	//	await this.app.withdraw(this.erc20.address, { from: admin });
	//	await this.app.withdrawBatch([this.erc20.address], { from: merchantUser });

		await this.app.processPendingPayments(0, 0, 1);
		// Check final balances
		const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
		const merchantShare = chargeCustomerPerInterval - ownerShare;
		const totalOwnerShare = ownerShare * 6;
		const totalMerchantShare = merchantShare * 6; //;

		const ownerExtraAmount = extraAmount * (platformFee / 1000);
		const merchantExtraAmount = extraAmount - ownerExtraAmount;

		expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(totalOwnerShare + (ownerExtraAmount *2))); // todo    + expected - actual
		//
		//       -300000
		//       +150000
		expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(totalMerchantShare + (merchantExtraAmount *2))); // expected '5700000' to equal '2950000'

	});

	});


	it('Customer accepts three orders with different ids and processes them with one having extra charge With 0 subscription fee', async () => {
		await this.app.setNowOverride(1);
		await this.app.createNewOrder(0, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, { from: merchantUser });
		await this.erc20.approve(this.app.address, 3 * (37 * chargeCustomerPerInterval), { from: customerUser }); // Approve 36 cycles of token transfers + 1st for all 3 orders

		await this.app.setNowOverride(2);

		// Customer accepts the orders
		const orderIds = [0, 0, 0];
		const customerIds = [stringToBytes32("customerOrder1"), stringToBytes32("customerOrder2"), stringToBytes32("customerOrder3")];

		for (let i = 0; i < orderIds.length; i++) {
			await this.app.customerAcceptOrder(orderIds[i], customerIds[i], extraBudgetCustomerPerInterval, 0, { from: customerUser });
		}

		await this.app.setNowOverride(2678403); // Move time forward to process payments

		// Batch process the orders with an extra charge on the third one
		const { receipt } = await this.app.batchProcessPayment([0, 0, 0], customerIds, false, [0, extraAmount, extraAmount], { from: merchantUser });

	 	await this.app.setNowOverride(5356800); // Move time forward to allow withdrawal

		await this.app.processPendingPayments(0, 0, 1);

		const ownerExtraAmount = extraAmount * (platformFee / 1000);
		const merchantExtraAmount = extraAmount - ownerExtraAmount;

		expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN((ownerExtraAmount *2))); // todo    + expected - actual
		//
		//       -300000
		//       +150000
		expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN((merchantExtraAmount *2))); // expected '5700000' to equal '2950000'
	});

	it('Customer accepts three orders with different ids and processes them with one having extra charge With 0 subscription fee plus check logic for custom merchant', async () => {
		await this.app.setNowOverride(1);
		await this.app.createNewOrder(0, extraBudgetCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, 0, { from: merchantUser });
		await this.erc20.approve(this.app.address, 3 * (37 * chargeCustomerPerInterval), { from: customerUser }); // Approve 36 cycles of token transfers + 1st for all 3 orders

		await this.app.setNowOverride(2);

		// Customer accepts the orders
		const orderIds = [0, 0, 0];
		const customerIds = [stringToBytes32("customerOrder1"), stringToBytes32("customerOrder2"), stringToBytes32("customerOrder3")];

		for (let i = 0; i < orderIds.length; i++) {
			await this.app.customerAcceptOrder(orderIds[i], customerIds[i], extraBudgetCustomerPerInterval, 0, { from: customerUser });
		}

		await this.app.setNowOverride(2678403); // Move time forward to process payments

		// Batch process the orders with an extra charge on the third one
		const { receipt } = await this.app.batchProcessPayment([0, 0, 0], customerIds, false, [0, extraAmount, extraAmount], { from: merchantUser });


		await this.app.processPendingPayments(0, 0, 1);

		const ownerExtraAmount = extraAmount * (platformFee / 1000);
		const merchantExtraAmount = extraAmount - ownerExtraAmount;

		expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN('0')); // todo    + expected - actual
		//
		//       -300000
		//       +150000
		expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN('0')); // expected '5700000' to equal '2950000'

		await this.app.setMerchantSpecificExtraBudgetLockTime(merchantUser, 5); // Preferential merchant lock down
		await this.app.setNowOverride(2678413); // 10 seconds forward works now

		await this.app.processPendingPayments(0, 0, 1);

		expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN((ownerExtraAmount *2))); // todo    + expected - actual
		//
		//       -300000
		//       +150000
		expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN((merchantExtraAmount *2))); // expected '5700000' to equal '2950000'
	});

	it('Change lock time for a specific merchant', async () => {

		let {receipt} = await this.app.setMerchantSpecificExtraBudgetLockTime(merchantUser, 4000);
		await expectEvent(receipt, 'SetMerchantSpecificExtraBudgetLockTime', {
			merchant: merchantUser,
			customLockTime: (new BN('4000')),
		});
		let time = await this.app.getMerchantSpecificExtraBudgetLockTime(merchantUser);
		expect(time).to.be.bignumber.equal(new BN('4000'))

		let timeAdmin = await this.app.getMerchantSpecificExtraBudgetLockTime(admin);
		expect(timeAdmin).to.be.bignumber.equal(new BN('604800'))
	});


	//TODO Coverage
	// Batch process payment with failure bytes message

	// process payment gas savings and not, with failures returning false



	async function getGasCosts(receipt) {
		const tx = await web3.eth.getTransaction(receipt.tx);
		const gasPrice = new BN(tx.gasPrice);
		return gasPrice.mul(new BN(receipt.receipt.gasUsed));
	}
});
