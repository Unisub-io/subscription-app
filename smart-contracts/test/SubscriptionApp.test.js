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
const WethToken = artifacts.require('WethToken.sol');
const GLDToken = artifacts.require('GLDToken.sol');
const SubscriptionAppReal = artifacts.require('SubscriptionApp.sol');

contract('SubscriptionApp', (accounts) => {
	const [admin, smartContract, merchantUser, customerUser, provider, anotherAccount] = accounts;

	const chargeCustomerPerInterval = 1000000; // 1 million wei of charge
	const cycleStartTime = 1;
	const cycleIntervalDuration = 3; // Monthly charges
	const platformFee = 50; // 5 %
	const erc20Address = '0x1111111111111111111111111111111111111111'; // TODO
	// this means 1 month at a time, uint256 _cycleStartTime, uint256 _cycleIntervalDuration, address _erc20

	beforeEach(async () => {
		this.app = await SubscriptionApp.new({from: admin});
		await this.app.initialize(50);

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
			await this.app.changeOwner('0x0000000000000000000000000000000000000000');
		});

		it('successfully revert for change owner wrong owner subscriptionApp changeOwner', async () => {
			await expectRevert(
				this.app.changeOwner('0x0000000000000000000000000000000000000000', {from: anotherAccount}),
				"Caller is not the owner"
			);
		});

		it('successfully call subscriptionApp defaultTotalIntervals', async () => {
			await this.app.changeDefaultTotalIntervals(24);
		});

		it('successfully revert for change defaultTotalIntervals wrong owner', async () => {
			await expectRevert(
				this.app.changeDefaultTotalIntervals(24, {from: anotherAccount}),
				"Caller is not the owner"
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
			await this.app.createNewOrder(chargeCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, {from: merchantUser});
		});


		it('successfully call to create an order by the merchant', async () => {
			await this.app.setNowOverride(1);
			const {receipt} = await this.app.createNewOrder(chargeCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, {from: merchantUser});
			await expectEvent(receipt, 'OrderCreated', {
				orderId: (new BN('0')),
				merchant: merchantUser,
				chargePerInterval: (new BN(chargeCustomerPerInterval)),
				startTime: (new BN(cycleStartTime)),
				intervalDuration: (new BN(cycleIntervalDuration)),
				erc20: this.erc20.address,
				merchantDefaultNumberOfOrderIntervals: (new BN('36'))
			});

			const {orderId, merchant, chargePerInterval, startTime, intervalDuration, erc20, paused, merchantDefaultNumberOfOrderIntervals} = await this.app.getOrder(0);

			expect(orderId).to.be.bignumber.equal(new BN('0'));
			expect(merchant).to.be.equal(merchantUser);
			expect(chargePerInterval).to.be.bignumber.equal(new BN(chargeCustomerPerInterval));
			expect(startTime).to.be.bignumber.equal(new BN(cycleStartTime));
			expect(intervalDuration).to.be.bignumber.equal(new BN(cycleIntervalDuration));
			expect(erc20).to.be.equal(this.erc20.address);
			expect(paused).to.be.equal(false);
			expect(merchantDefaultNumberOfOrderIntervals).to.be.bignumber.equal(new BN('36'));
		});

		it('successfully call to create an order by the merchantUser and pause it', async () => {
			await this.app.createNewOrder(chargeCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, {from: merchantUser});
			await this.app.setOrderPauseState(0, true, {from: merchantUser});
		});

		it('successfully call to create an order by the merchantUser and change its default number of intervals', async () => {
			await this.app.createNewOrder(chargeCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, {from: merchantUser});
			await this.app.setMerchantDefaultNumberOfOrderIntervals(0, 10, {from: merchantUser});


			const {orderId, merchant, chargePerInterval, startTime, intervalDuration, erc20, paused, merchantDefaultNumberOfOrderIntervals} = await this.app.getOrder(0);

			expect(orderId).to.be.bignumber.equal(new BN('0'));
			expect(merchant).to.be.equal(merchantUser);
			expect(chargePerInterval).to.be.bignumber.equal(new BN(chargeCustomerPerInterval));
			expect(startTime).to.be.bignumber.equal(new BN('0'));
			expect(intervalDuration).to.be.bignumber.equal(new BN(cycleIntervalDuration));
			expect(erc20).to.be.equal(this.erc20.address);
			expect(paused).to.be.equal(false);
			expect(merchantDefaultNumberOfOrderIntervals).to.be.bignumber.equal(new BN('10'));
		});

		it('successfully call to create an order by the merchantUser and pause it by owner', async () => {
			await this.app.createNewOrder(chargeCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, {from: merchantUser});
			await this.app.setOrderPauseState(0, true, {from: admin});
		});

		it('reverts when calling an order by the NOT the merchantUser to pause it', async () => {
			await this.app.createNewOrder(chargeCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, {from: merchantUser});
			await expectRevert(
				this.app.setOrderPauseState(0, true, {from: customerUser}),
				"Only the merchant or owner can pause");
		});
		it('reverts if not a token contract', async () => {
			await expectRevert(
				this.app.createNewOrder(chargeCustomerPerInterval, cycleIntervalDuration, merchantUser, 36, {from: merchantUser}),
				"ERC20 token not compatible");
		});
		it('reverts if 0 default periods', async () => {
			await expectRevert(
				this.app.createNewOrder(chargeCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 0, {from: merchantUser}),
				"Default number of intervals must be above 0");
		});
	});

	describe('try to accept offer', () => {
		beforeEach(async () => {
			await this.app.setNowOverride(2);
			await this.app.createNewOrder(chargeCustomerPerInterval, cycleIntervalDuration, this.erc20.address, 36, {from: merchantUser});

			// The customer needs to approve this
			await this.erc20.approve(this.app.address, 37 * chargeCustomerPerInterval, {from: customerUser}); // Approve 36 cycles of token transfers + 1st
		});
		it('Customer accepts the offer', async () => {
			await this.app.setNowOverride(3);
			const {receipt} = await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			await expectEvent(receipt, 'OrderAccepted', {
				orderId: (new BN('0')),
				customer: customerUser,
				startTime: (new BN(3)),
				approvedPeriodsRemaining: (new BN(36)),
			});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			const { customer, approvedPeriodsRemaining, firstPaymentMadeTimestamp, numberOfIntervalsPaid, terminated, amountPaidToDate} = await this.app.getCustomerOrder(0, customerUser);
			expect(customer).to.be.equal(customerUser);
			expect(approvedPeriodsRemaining).to.be.bignumber.equal(new BN(36));
			expect(firstPaymentMadeTimestamp).to.be.bignumber.equal(new BN(3));
			expect(numberOfIntervalsPaid).to.be.bignumber.equal(new BN(1));
			expect(terminated).to.be.equal(false);
			expect(amountPaidToDate).to.be.bignumber.equal(new BN(chargeCustomerPerInterval));

			const { timestamp, amount, feePercentage } = await this.app.getPaymentHistoryEntry(0, customerUser, 0);
			expect(timestamp).to.be.bignumber.equal(new BN(3));
			expect(amount).to.be.bignumber.equal(new BN(chargeCustomerPerInterval));
			expect(feePercentage).to.be.bignumber.equal(new BN(platformFee));
		});

		it('Customer accepts the offer but insufficient allowance', async () => {
			await this.app.setNowOverride(3);
			await this.erc20.approve(this.app.address, 0, {from: customerUser}); // 0 approval
			await expectRevert(
				this.app.customerAcceptOrder(0, 0, {from: customerUser}),
				"Insufficient erc20 allowance"
			);
		});

		it('Customer accepts the offer but insufficient balance', async () => {
			await this.app.setNowOverride(3);
			await this.erc20.transfer(admin, 100000000, {from: customerUser}); // Send back all my balance
			await expectRevert(
				this.app.customerAcceptOrder(0, 0, {from: customerUser}),
				"Insufficient balance first month"
			);
		});

		it('Customer accepts the offer custom cycle amount of 24', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 24, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			const { customer, approvedPeriodsRemaining, firstPaymentMadeTimestamp, numberOfIntervalsPaid, terminated, amountPaidToDate} = await this.app.getCustomerOrder(0, customerUser);
			expect(customer).to.be.equal(customerUser);
			expect(approvedPeriodsRemaining).to.be.bignumber.equal(new BN(24));
			expect(firstPaymentMadeTimestamp).to.be.bignumber.equal(new BN(3));
			expect(numberOfIntervalsPaid).to.be.bignumber.equal(new BN(1));
			expect(terminated).to.be.equal(false);
			expect(amountPaidToDate).to.be.bignumber.equal(new BN(chargeCustomerPerInterval));
		});

		it('Customer accepts the offer and gets first payment charged', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// One month later will be about 2678400 seconds
			await this.app.setNowOverride(2678403);
			const {receipt} = await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});
			await expectEvent(receipt, 'OrderPaidOut', {
				orderId: (new BN('0')),
				customer: customerUser,
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
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
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
			receipt = await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});
			await expectEvent(receipt, 'OrderPaidOut', {
				orderId: (new BN('0')),
				customer: customerUser,
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
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
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
			receipt = await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});
			await expectEvent(receipt, 'OrderPaidOut', {
				orderId: (new BN('0')),
				customer: customerUser,
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
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// One month later will be about 2678400 seconds
			await this.app.setNowOverride(2600000);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			// no change in balance
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));
		});

		it('Sends ten times if ten month has elapsed', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			// no change in balance
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 11));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 11));
		});

		it('If 40 months elapsed, only send for the approved 36 months', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 40
			await this.app.setNowOverride(107136003);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			// no change in balance
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 37)); // 36 months plus first month pay
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 37));
		});

		it('Cancels the order and renders it not payable', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			let {receipt} = await this.app.customerCancelOrder(0, customerUser, {from:customerUser});
			await expectEvent(receipt, 'OrderCancelled', {
				orderId: (new BN('0')),
				customer: customerUser
			});
			receipt = await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});
			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "This payment has been cancelled",
				orderId: (new BN('0')),
				customer: customerUser
			});
		});
		it('Cannot cancel order by random account', async () => {
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
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
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			await this.app.customerCancelOrder(0, customerUser, {from:customerUser});
			let {receipt} = await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});
			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "This payment has been cancelled",
				orderId: (new BN('0')),
				customer: customerUser
			});

			// 2 month later renew membership
			await this.app.setNowOverride(53568000);
			receipt = await this.app.customerRenewOrder(0,0, {from: customerUser});
			await expectEvent(receipt, 'OrderRenewed', {
				orderId: (new BN('0')),
				customer: customerUser,
				startTime: (new BN('53568000')),
				approvedPeriodsRemaining: (new BN(36)),
				orderRenewedNotExtended: true,
			});

			// First payment was made again at this point
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2));

			// Go through 36 more months
			await this.app.setNowOverride(1210636800);

			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser})

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 38));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 38));
		});

		it('Cancel order and renew but insufficient allowance', async () => {
			await this.erc20.approve(this.app.address, 50 * chargeCustomerPerInterval, {from: customerUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			await this.app.customerCancelOrder(0, customerUser, {from:customerUser});
			const {receipt} = await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});
			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "This payment has been cancelled",
				orderId: (new BN('0')),
				customer: customerUser
			});

			// 2 month later renew membership
			await this.app.setNowOverride(53568000);
			await this.erc20.approve(this.app.address, 0, {from: customerUser}); // 0 approval
			await expectRevert(
				this.app.customerRenewOrder(0,0, {from: customerUser}),
				"Insufficient erc20 allowance"
			);
		});

		it('Cancel order and renew but insufficient balance', async () => {
			await this.erc20.approve(this.app.address, 50 * chargeCustomerPerInterval, {from: customerUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 2
			await this.app.setNowOverride(26784003);
			await this.app.customerCancelOrder(0, customerUser, {from:customerUser});
			const {receipt} = await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});
			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "This payment has been cancelled",
				orderId: (new BN('0')),
				customer: customerUser
			});

			// 2 month later renew membership
			await this.app.setNowOverride(53568000);
			await this.erc20.transfer(admin, 100000000 - chargeCustomerPerInterval, {from: customerUser}); // Send back all my balance
			await expectRevert(
				this.app.customerRenewOrder(0,0, {from: customerUser}),
				"Insufficient balance"
			);
		});

		it('Just extends the order', async () => {
			await this.erc20.approve(this.app.address, 80 * chargeCustomerPerInterval, {from: customerUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 40
			await this.app.setNowOverride(107136003);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			// no change in balance
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 37)); // 36 months plus first month pay
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 37));

			// 4 months over due and we are going to renew 36 more months on top.

			const {receipt} = await this.app.customerRenewOrder(0,36, {from: customerUser});
			await expectEvent(receipt, 'OrderRenewed', {
				orderId: (new BN('0')),
				customer: customerUser,
				startTime: (new BN('3')),
				approvedPeriodsRemaining: (new BN(36)),
				orderRenewedNotExtended: false,
			});
			await this.app.setNowOverride(964224000);

			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 73));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 73));
		});

		it('Just extends the order, assure that without the payment in between same balance is gotten from extend in final payment', async () => {
			await this.erc20.approve(this.app.address, 80 * chargeCustomerPerInterval, {from: customerUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Customer accepted order at timestamp 3.
			// Two month later will be about 2678400 seconds x 40
			await this.app.setNowOverride(107136003);

			await this.app.customerRenewOrder(0,36, {from: customerUser});

			await this.app.setNowOverride(964224000);

			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

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
			await this.app.createNewOrder(chargeCustomerPerInterval, biweekly, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// First biweekly payment after 14 days
			await this.app.setNowOverride(1209603);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2));

			// 14 days more
			await this.app.setNowOverride(2419203);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 3));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 3));
		});

		it('Sends weekly', async () => {
			const weekly = 5;
			await this.app.createNewOrder(chargeCustomerPerInterval, weekly, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// First weekly payment after 7 days
			await this.app.setNowOverride(604803);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2));

			// 14 days in
			await this.app.setNowOverride(1209603);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 3));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 3));
		});

		it('Sends daily', async () => {
			const daily = 6;
			await this.app.createNewOrder(chargeCustomerPerInterval, daily, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 days (7 cycles)
			await this.app.setNowOverride(604803);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 days in
			await this.app.setNowOverride(1209603);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends hourly', async () => {
			const hourly = 7;
			await this.app.createNewOrder(chargeCustomerPerInterval, hourly, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 hours (7 cycles)
			await this.app.setNowOverride(25203);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 hours in
			await this.app.setNowOverride(50403);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends by minute', async () => {
			const minute = 8;
			await this.app.createNewOrder(chargeCustomerPerInterval, minute, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 minutes (7 cycles)
			await this.app.setNowOverride(423);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 minutes in
			await this.app.setNowOverride(843);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends by second', async () => {
			const second = 9;
			await this.app.createNewOrder(chargeCustomerPerInterval, second, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 seconds (7 cycles)
			await this.app.setNowOverride(10);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 seconds in
			await this.app.setNowOverride(17);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends yearly', async () => {
			const yearly = 0;
			await this.app.createNewOrder(chargeCustomerPerInterval, yearly, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 years (7 cycles)
			await this.app.setNowOverride(224985603);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 years in
			await this.app.setNowOverride(449971203);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends semi-yearly', async () => {
			const semiyearly = 1;
			await this.app.createNewOrder(chargeCustomerPerInterval, semiyearly, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 years (7 cycles)
			await this.app.setNowOverride(112492800);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 years in
			await this.app.setNowOverride(224985603);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Sends quarter-yearly', async () => {
			const quarteryearly = 2;
			await this.app.createNewOrder(chargeCustomerPerInterval, quarteryearly, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			// Most important is make sure that the merchantUser and owner got their share
			const ownerShare = chargeCustomerPerInterval * (platformFee / 1000);
			const merchantShare = chargeCustomerPerInterval - ownerShare;

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare));

			// Payment after 7 years (7 cycles)
			await this.app.setNowOverride(56246403);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 8));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 8));

			// 14 years in
			await this.app.setNowOverride(112492800);
			await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 15));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 15));
		});

		it('Call payment but insufficient allowance', async () => {
			const quarteryearly = 2;
			await this.app.createNewOrder(chargeCustomerPerInterval, quarteryearly, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			await this.app.setNowOverride(56246403);
			await this.erc20.approve(this.app.address, 0, {from: customerUser}); // 0 approval
			const {receipt} = await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "Insufficient erc20 allowance",
				orderId: (new BN('0')),
				customer: customerUser
			});
		});

		it('Call payment but insufficient balance', async () => {
			const quarteryearly = 2;
			await this.app.createNewOrder(chargeCustomerPerInterval, quarteryearly, this.erc20.address, 36, {from: merchantUser});
			await this.app.setNowOverride(3);
			await this.app.customerAcceptOrder(0, 0, {from: customerUser});
			await this.app.setNowOverride(56246403);
			await this.erc20.transfer(admin, 100000000 - chargeCustomerPerInterval, {from: customerUser}); // Send back all my balance

			const {receipt} = await this.app.batchProcessPayment([0],[customerUser], false, {from:merchantUser});

			await expectEvent(receipt, 'PaymentFailure', {
				revertString: "Insufficient balance",
				orderId: (new BN('0')),
				customer: customerUser
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
				await this.app.createNewOrder(smallPayment, cycleIntervalDuration, this.erc20.address, 36, {from: merchantUser}); // 100,000 wei
			}
			await this.app.setNowOverride(3);
			for(let i=0; i<howManyPayments;i++) {
				await this.app.customerAcceptOrder(i, 0, {from: customerUser});
			}
			await this.app.setNowOverride(2678403);

			await this.app.batchProcessPayment([...Array(howManyPayments).keys()],Array(howManyPayments).fill(customerUser), false, {from:merchantUser});

			const ownerShare = smallPayment * (platformFee / 1000);
			const merchantShare = smallPayment - ownerShare;
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 2 * howManyPayments ));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 2 * howManyPayments));
		});
		it('Tests sending many payments with gas savings', async () => {
			const howManyPayments = 10; // 170 works -- keep low to run test in reasonable time
			const smallPayment = 100000;
			const enoughWeiToMakeTx = howManyPayments * smallPayment * 10000;// could be reduced (todo)
			this.erc20 = await GLDToken.new(enoughWeiToMakeTx, {from: admin}); // 100 million wei of gold
			await this.erc20.transfer(customerUser, enoughWeiToMakeTx, {from: admin}); // 100 million wei of gold, transfer all to customer
			await this.erc20.approve(this.app.address, enoughWeiToMakeTx, {from: customerUser}); // Approve 36 cycles of token transfers + 1st

			for(let i=0; i<howManyPayments;i++) {
				await this.app.createNewOrder(smallPayment, cycleIntervalDuration, this.erc20.address, 36, {from: merchantUser}); // 100,000 wei
			}
			await this.app.setNowOverride(3);
			for(let i=0; i<howManyPayments;i++) {
				await this.app.customerAcceptOrder(i, 0, {from: customerUser});
			}
			await this.app.setNowOverride(2678403);

			await this.app.batchProcessPayment([...Array(howManyPayments).keys()],Array(howManyPayments).fill(customerUser), true, {from:merchantUser});

			const ownerShare = smallPayment * (platformFee / 1000);
			const merchantShare = smallPayment - ownerShare;


			expect(await this.erc20.balanceOf(this.app.address)).to.be.bignumber.equal(new BN((merchantShare + ownerShare) * 1 * howManyPayments));

			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare * 1 * howManyPayments ));
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare * 1 * howManyPayments));

			await this.app.withdraw(this.erc20.address, {from: admin});
			expect(await this.erc20.balanceOf(admin)).to.be.bignumber.equal(new BN(ownerShare + (ownerShare * howManyPayments)));

			await this.app.withdrawBatch([this.erc20.address], {from: merchantUser});
			expect(await this.erc20.balanceOf(merchantUser)).to.be.bignumber.equal(new BN(merchantShare + (merchantShare * howManyPayments)));
		});
	});

	async function getGasCosts(receipt) {
		const tx = await web3.eth.getTransaction(receipt.tx);
		const gasPrice = new BN(tx.gasPrice);
		return gasPrice.mul(new BN(receipt.receipt.gasUsed));
	}
});
