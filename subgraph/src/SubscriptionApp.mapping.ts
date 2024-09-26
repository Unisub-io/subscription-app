import { BigInt, Address, log, Bytes } from "@graphprotocol/graph-ts/index";

import {
    MerchantWithdrawERC20,
    OrderAccepted,
    OrderCancelled,
    OrderCreated,
    OrderPaidOut,
    OrderPaidOutGasSavingMode,
    OrderPaused,
    OrderRenewed,
    OwnerWithdrawERC20,
    PaymentFailure,
    SubscriptionApp,
    SuccessfulPay,
    OrderSetMerchantDefaultNumberOfOrderIntervals,
    ExtraBudgetLogged,
    ExtraBudgetPaymentProcessed,
    ExtraBudgetPaidOut,
    SetMerchantSpecificExtraBudgetLockTime,
    ExtraBudgetRefunded
} from "../generated/SubscriptionApp/SubscriptionApp";

import {
    Customer,
    CustomerERC20ApprovalAndBalance,
    CustomerGasSavingDepositHistory,
    CustomerOrder,
    CustomerOrderPaymentHistory,
    CustomerWallet,
    ERC20Token,
    ExtraBudgetPaidOutRecord,
    ExtraBudgetRefundedRecord,
    ExtraBudgetRequest,
    FailedPayment,
    Merchant,
    MerchantERC20DepositsBalance,
    MerchantWithdrawalHistory,
    Order,
    OwnerERC20DepositsBalance,
    OwnerWithdrawalHistory,
    SuccessfulPayment,
    Wallet
} from "../generated/schema";

import {ERC20} from "../generated/SubscriptionApp/ERC20";
import {ONE, ZERO} from "./constants";
import {Entity} from "@graphprotocol/graph-ts";
//const subsAddress = "0x639e1b11303cb337835b655bfc74de0c4c771c90"; //goerli
//const subsAddress = "0x4bA75555E692C7C400322C96b9264A0a7f0a4719"; //mumbai
//const subsAddress = "0x80E04D1313cFD5AF97B275E0E07021C0bB627F46"; //polygon
//const subsAddress = "0x6a2245521063C0432b164A7620212a167d7A3b08"; //bsc and mainnet
const subsAddress = "0x4e84f364aea2ab3853efa73bb1ac7a46a1293a25"; //new poly

export function handleOrderCreated(event: OrderCreated): void {
  let order = new Order(event.params.orderId.toString());
  let merchant = Merchant.load(event.params.merchant.toHexString());
  if(!merchant){
      merchant = new Merchant(event.params.merchant.toHexString());
  }

  order.chargePerInterval = event.params.chargePerInterval;
  order.extraBudgetPerInterval = event.params.extraBudgetPerInterval;
  order.paused = false;
  order.merchant = merchant.id;
  order.totalCharged = ZERO;
  order.numberOfCustomers = ZERO;
  // Process erc20 token
  let erc20Token = ERC20Token.load(event.params.erc20.toHexString());
  if(!erc20Token){
      erc20Token = new ERC20Token(event.params.erc20.toHexString());
      // TODO scrape on chain and get erc20 token information
      const contract = ERC20.bind(event.params.erc20);
      let tryName = contract.try_name();
      if (!tryName.reverted) {
            erc20Token.name = tryName.value;
      } else {
          erc20Token.name = "Not compatible token";
      }
      let trySymbol = contract.try_symbol();
      if (!trySymbol.reverted) {
            erc20Token.symbol = trySymbol.value;
      } else{
          erc20Token.symbol = "ERROR"
      }
      let tryDecimals = contract.try_decimals();
      if (!tryDecimals.reverted) {
            erc20Token.decimals = BigInt.fromI32(tryDecimals.value);
      } else {
          erc20Token.decimals = ZERO;
      }

      erc20Token.save();
  }
  order.erc20 = erc20Token.id;
  // Process interval duration human readable
  let intervalDuration = event.params.intervalDuration;
  if(intervalDuration.equals(BigInt.fromI32(0))) {
        order.intervalDuration = "Yearly"
  }else if(intervalDuration.equals(BigInt.fromI32(1))) {
    order.intervalDuration = "Semi-Yearly"
  }else if(intervalDuration.equals(BigInt.fromI32(2))) {
    order.intervalDuration = "Quarter-Yearly"
  }else if(intervalDuration.equals(BigInt.fromI32(3))) {
    order.intervalDuration = "Monthly"
  }else if(intervalDuration.equals(BigInt.fromI32(4))) {
    order.intervalDuration = "Bi-Weekly"
  }else if(intervalDuration.equals(BigInt.fromI32(5))) {
    order.intervalDuration = "Weekly"
  }else if(intervalDuration.equals(BigInt.fromI32(6))) {
      order.intervalDuration = "Daily"
  }else if(intervalDuration.equals(BigInt.fromI32(7))) {
      order.intervalDuration = "Hourly"
  }else if(intervalDuration.equals(BigInt.fromI32(8))) {
      order.intervalDuration = "Minute"
  }
else if(intervalDuration.equals(BigInt.fromI32(9))) {
      order.intervalDuration = "Second"
  }

  order.startTime = event.params.startTime;

  order.merchantDefaultNumberOfOrderIntervals = event.params.merchantDefaultNumberOfOrderIntervals;

  order.save();
  merchant.save();
}

function getNextPaymentTimestamp(intervalDuration: string, firstTimestamp: BigInt, numberOfIntervalsPaid: BigInt): BigInt{
    const contract = SubscriptionApp.bind(Address.fromString(subsAddress));
    if(intervalDuration == "Yearly") {
        let tryAddYears = contract.try_addYearsToTimestamp(firstTimestamp, numberOfIntervalsPaid);
        if (!tryAddYears.reverted) {
            return tryAddYears.value;
        } else {
            return firstTimestamp.plus(numberOfIntervalsPaid.times(BigInt.fromI32(31449600))); // any error, just use a set amount of time for a year
        }
    } else if(intervalDuration == "Semi-Yearly") {
        let tryAddMonths = contract.try_addMonthsToTimestamp(firstTimestamp, numberOfIntervalsPaid.times(BigInt.fromI32(6)));
        if (!tryAddMonths.reverted) {
            return tryAddMonths.value;
        } else {
            return firstTimestamp.plus(numberOfIntervalsPaid.times(BigInt.fromI32(15724800))); // any error, just use a set amount of time for a year
        }
    }  else if(intervalDuration == "Quarter-Yearly") {
        let tryAddMonths = contract.try_addMonthsToTimestamp(firstTimestamp, numberOfIntervalsPaid.times(BigInt.fromI32(3)));
        if (!tryAddMonths.reverted) {
            return tryAddMonths.value;
        } else {
            return firstTimestamp.plus(numberOfIntervalsPaid.times(BigInt.fromI32(7862400))); // any error, just use a set amount of time for a year
        }
    }  else if(intervalDuration == "Monthly") {
        let tryAddMonths = contract.try_addMonthsToTimestamp(firstTimestamp, numberOfIntervalsPaid);
        if (!tryAddMonths.reverted) {
            return tryAddMonths.value;
        } else {
            return firstTimestamp.plus(numberOfIntervalsPaid.times(BigInt.fromI32(2419200))); // any error, just use a set amount of time for a year
        }
    }  else if(intervalDuration == "Bi-Weekly") {
       return firstTimestamp.plus(numberOfIntervalsPaid.times(BigInt.fromI32(1209600)));
    }  else if(intervalDuration == "Weekly") {
       return firstTimestamp.plus(numberOfIntervalsPaid.times(BigInt.fromI32(604800)));
    }  else if(intervalDuration == "Daily") {
       return firstTimestamp.plus(numberOfIntervalsPaid.times(BigInt.fromI32(86400)));
    }  else if(intervalDuration == "Hourly") {
       return firstTimestamp.plus(numberOfIntervalsPaid.times(BigInt.fromI32(3600)));
    }  else if(intervalDuration == "Minute") {
       return firstTimestamp.plus(numberOfIntervalsPaid.times(BigInt.fromI32(60)));
    }  else if(intervalDuration == "Second") {
       return firstTimestamp.plus(numberOfIntervalsPaid);
    } else {
        return firstTimestamp;
    }
}

class SetupResult {
    customer: Customer;
    wallet: Wallet;
    customerWallet: CustomerWallet;

    constructor(customer: Customer, wallet: Wallet, customerWallet: CustomerWallet) {
        this.customer = customer;
        this.wallet = wallet;
        this.customerWallet = customerWallet;
    }
}

function setupCustomerAndWallet(
    customerId: string,
    customerAddress: string
): SetupResult {
    let customer = Customer.load(customerId);
    if (!customer) {
        customer = new Customer(customerId);
        customer.save();
    }

    let wallet = Wallet.load(customerAddress);
    if (!wallet) {
        wallet = new Wallet(customerAddress);
        wallet.save();
    }

    let customerWalletId = customerId.concat("-").concat(customerAddress);
    let customerWallet = CustomerWallet.load(customerWalletId);
    if (!customerWallet) {
        customerWallet = new CustomerWallet(customerWalletId);
        customerWallet.wallet = wallet.id;
        customerWallet.customer = customer.id;
        customerWallet.save();
    }

    return new SetupResult(customer, wallet, customerWallet);
}

export function handleOrderAccepted(event: OrderAccepted): void {
    // Set up customer and wallet
    let setupResult= setupCustomerAndWallet(
        event.params.customerId.toHexString(),
        event.params.customerAddress.toHexString()
    );

    if (setupResult.customer === null || setupResult.wallet === null || setupResult.customerWallet === null) {
        log.error("One of the entities (Customer, Wallet, CustomerWallet) is null for customerId: {}", [event.params.customerId.toHexString()]);
        return;
    }
    let customer = setupResult.customer;
    let wallet = setupResult.wallet;
    let customerWallet = setupResult.customerWallet;

    // Get the order
    let order = Order.load(event.params.orderId.toString());

    // Setup the customer order and the payment info
    if (order) {
        let customerOrderId = event.params.orderId.toString().concat("-").concat(customerWallet.id);
        let customerOrder = new CustomerOrder(customerOrderId);  //# orderId - customer Eth address
        customerOrder.order = order.id;
        customerOrder.customerWallet = customerWallet.id;
        customerOrder.merchant = order.merchant;
        customerOrder.approvedPeriodsRemaining = event.params.approvedPeriodsRemaining;
        customerOrder.firstPaymentMadeTimestamp = event.params.startTime;
        customerOrder.numberOfIntervalsPaid = BigInt.fromI32(1);
        customerOrder.trialIntervalsRemaining = event.params.trialIntervalsRemaining;
        customerOrder.terminated = false;
        customerOrder.amountPaidToDate = order.chargePerInterval;
        customerOrder.numberOfPaymentsInHistory = BigInt.fromI32(1);
        customerOrder.lastOutstandingPaymentFailed = false;
        customerOrder.nextPaymentTimestamp = getNextPaymentTimestamp(order.intervalDuration, event.params.startTime, BigInt.fromI32(1));
        customerOrder.extraBudgetPerInterval = event.params.extraBudgetPerInterval;
        customerOrder.save();

        let customerOrderPaymentHistoryId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-0");
        let customerOrderPaymentHistory = new CustomerOrderPaymentHistory(customerOrderPaymentHistoryId);  //# orderId - customer Eth address - index
        customerOrderPaymentHistory.merchant = order.merchant;
        customerOrderPaymentHistory.customerWallet = customerWallet.id;
        customerOrderPaymentHistory.order = order.id;
        customerOrderPaymentHistory.customerOrder = customerOrder.id;
        customerOrderPaymentHistory.timestamp = event.block.timestamp;
        customerOrderPaymentHistory.txHash = event.transaction.hash;
        customerOrderPaymentHistory.amount = order.chargePerInterval;
        customerOrderPaymentHistory.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
        customerOrderPaymentHistory.description = `Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant} without gas savings mode`;
        customerOrderPaymentHistory.feePercentage = BigInt.fromI32(0);
        customerOrderPaymentHistory.gasSaving = false;
        const contract = SubscriptionApp.bind(Address.fromString(subsAddress));
        let tryFee = contract.try_platformFee(Address.fromString(order.merchant));
        if (!tryFee.reverted) {
            customerOrderPaymentHistory.feePercentage = tryFee.value;
        }
        customerOrderPaymentHistory.save();

        // Add the successful payment here
        let successfulPaymentId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(event.transaction.hash.toHexString());
        let successfulPayment = new SuccessfulPayment(successfulPaymentId);
        successfulPayment.customerWallet = customerWallet.id;
        successfulPayment.merchant = order.merchant;
        successfulPayment.customerOrder = customerOrder.id;
        successfulPayment.order = order.id;
        successfulPayment.txHash = event.transaction.hash;
        successfulPayment.timestamp = event.block.timestamp;
        successfulPayment.amount = order.chargePerInterval;
        successfulPayment.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
        successfulPayment.description = `Successful Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant}`;
        successfulPayment.save();

        // Query the erc20 contract as we need to update the customer erc20 approval and balance
        let approvalAndBalanceId = order.erc20.toString().concat("-").concat(customerWallet.id);
        let approvalAndBalance = CustomerERC20ApprovalAndBalance.load(approvalAndBalanceId);
        if (!approvalAndBalance) {
            approvalAndBalance = new CustomerERC20ApprovalAndBalance(approvalAndBalanceId);
            approvalAndBalance.erc20 = order.erc20;
            approvalAndBalance.customerWallet = customerWallet.id;
        }
        const erc20Contract = ERC20.bind(Address.fromString(order.erc20));
        let tryAllowance = erc20Contract.try_allowance(Address.fromString(wallet.id), Address.fromString(subsAddress));
        if (!tryAllowance.reverted) {
            approvalAndBalance.currentAllowance = tryAllowance.value;
        }
        let tryBalance = erc20Contract.try_balanceOf(Address.fromString(wallet.id));
        if (!tryBalance.reverted) {
            approvalAndBalance.currentBalance = tryBalance.value;
        }
        approvalAndBalance.save();

        order.totalCharged = order.totalCharged.plus(order.chargePerInterval);
        order.numberOfCustomers = order.numberOfCustomers.plus(ONE);
        order.save();
    }
}


export function handleOrderPaidOut(event: OrderPaidOut): void {
    // Get the customers address
    let subsapp = SubscriptionApp.bind(Address.fromString(subsAddress));

    let tryCustomerIdToAddress = subsapp.try_customerIdToAddress(event.params.customerId);
    if (tryCustomerIdToAddress.reverted) {
        // Log the error for debugging purposes
        log.warning("Transaction reverted for customerId: {}", [event.params.customerId.toHexString()]);
        return;
    }

    let userAddress = tryCustomerIdToAddress.value;

    if (!userAddress || userAddress.toHexString() == "") {
        // Log the error for debugging purposes
        log.error("User address is null or empty for customerId: {}", [event.params.customerId.toHexString()]);
        return;
    }

    let setupResult= setupCustomerAndWallet(
        event.params.customerId.toHexString(),
        userAddress.toHexString()
    );

    if (setupResult.customer === null || setupResult.wallet === null || setupResult.customerWallet === null) {
        log.error("One of the entities (Customer, Wallet, CustomerWallet) is null for customerId: {}", [event.params.customerId.toHexString()]);
        return;
    }
    let customer = setupResult.customer;
    let wallet = setupResult.wallet;
    let customerWallet = setupResult.customerWallet;

    if(customerWallet) {
        // Get the order
        let order = Order.load(event.params.orderId.toString());

        // Setup the customer order and the payment info
        if (order) {
            let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
            let customerOrder = CustomerOrder.load(customerOrderId);  //# orderId - customer Eth address
            if(customerOrder) {
                // TODO this block, update the order
                const contract = SubscriptionApp.bind(Address.fromString(subsAddress));
                let tryGetCustomerOrder = contract.try_getCustomerOrder(event.params.orderId, Address.fromString(customer.id));
                if (!tryGetCustomerOrder.reverted) {

                    customerOrder.approvedPeriodsRemaining = tryGetCustomerOrder.value.value5;
                    customerOrder.trialIntervalsRemaining = tryGetCustomerOrder.value.value6;
                    customerOrder.firstPaymentMadeTimestamp = tryGetCustomerOrder.value.value7;
                    customerOrder.numberOfIntervalsPaid = tryGetCustomerOrder.value.value8;
                    customerOrder.terminated = tryGetCustomerOrder.value.value9;
                    customerOrder.amountPaidToDate = tryGetCustomerOrder.value.value10;
                    customerOrder.lastOutstandingPaymentFailed = false;
                    customerOrder.nextPaymentTimestamp = getNextPaymentTimestamp(order.intervalDuration, tryGetCustomerOrder.value.value7, tryGetCustomerOrder.value.value8);
                    customerOrder.save();
                }

                let customerOrderPaymentHistoryId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(customerOrder.numberOfPaymentsInHistory.toString());
                let customerOrderPaymentHistory = new CustomerOrderPaymentHistory(customerOrderPaymentHistoryId);  //# orderId - customer Eth address - index
                customerOrderPaymentHistory.merchant = order.merchant;
                customerOrderPaymentHistory.customerWallet = customerWallet.id;
                customerOrderPaymentHistory.order = order.id;
                customerOrderPaymentHistory.customerOrder = customerOrder.id;
                customerOrderPaymentHistory.timestamp = event.block.timestamp;
                customerOrderPaymentHistory.txHash = event.transaction.hash;
                customerOrderPaymentHistory.amount = order.chargePerInterval;
                customerOrderPaymentHistory.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
                customerOrderPaymentHistory.description = `Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant} without gas savings mode`;
                customerOrderPaymentHistory.gasSaving = false;
                customerOrderPaymentHistory.feePercentage = BigInt.fromI32(0);
                let tryFee = contract.try_platformFee(Address.fromString(order.merchant));
                if (!tryFee.reverted) {
                    customerOrderPaymentHistory.feePercentage = tryFee.value;
                }

                customerOrderPaymentHistory.save();

                let successfulPaymentId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(event.transaction.hash.toHexString());
                let successfulPayment = new SuccessfulPayment(successfulPaymentId);
                successfulPayment.customerWallet = customerWallet.id;
                successfulPayment.merchant = order.merchant;
                successfulPayment.customerOrder = customerOrder.id;
                successfulPayment.order = order.id;
                successfulPayment.txHash = event.transaction.hash;
                successfulPayment.timestamp = event.block.timestamp;
                successfulPayment.amount =  event.params.amount;
                successfulPayment.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
                successfulPayment.description = `Successful Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant}`;
                successfulPayment.save();

                customerOrder.numberOfPaymentsInHistory = customerOrder.numberOfPaymentsInHistory.plus(BigInt.fromI32(1))
                customerOrder.save();

                // Query the erc20 contract as we need to update the customer erc20 approval and balance
                let approvalAndBalanceId = order.erc20.toString().concat("-").concat(customerWallet.id);
                let approvalAndBalance = CustomerERC20ApprovalAndBalance.load(approvalAndBalanceId);
                if (approvalAndBalance) {
                    const erc20Contract = ERC20.bind(Address.fromString(order.erc20));
                    let tryAllowance = erc20Contract.try_allowance(Address.fromString(wallet.id), Address.fromString(subsAddress));
                    if (!tryAllowance.reverted) {
                        approvalAndBalance.currentAllowance = tryAllowance.value;
                    }
                    let tryBalance = erc20Contract.try_balanceOf(Address.fromString(wallet.id));
                    if (!tryBalance.reverted) {
                        approvalAndBalance.currentBalance = tryBalance.value;
                    }
                    approvalAndBalance.save();
                }
            }
            order.totalCharged = order.totalCharged.plus(event.params.amount);
            order.save();
        }

        customer.save();
    }
}

export function handleOrderPaidOutGasSavingMode (event: OrderPaidOutGasSavingMode): void {
// Get the customers address
    let subsapp = SubscriptionApp.bind(Address.fromString(subsAddress));
    let tryCustomerIdToAddress = subsapp.try_customerIdToAddress(event.params.customerId);
    if (tryCustomerIdToAddress.reverted) {
        return;
    }

    let userAddress = tryCustomerIdToAddress.value;

    let setupResult= setupCustomerAndWallet(
        event.params.customerId.toHexString(),
        userAddress.toHexString()
    );

    if (setupResult.customer === null || setupResult.wallet === null || setupResult.customerWallet === null) {
        log.error("One of the entities (Customer, Wallet, CustomerWallet) is null for customerId: {}", [event.params.customerId.toHexString()]);
        return;
    }
    let customer = setupResult.customer;
    let wallet = setupResult.wallet;
    let customerWallet = setupResult.customerWallet;

    if(customerWallet) {
        // Get the order
        let order = Order.load(event.params.orderId.toString());

        // Setup the customer order and the payment info
        if (order) {
            let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
            let customerOrder = CustomerOrder.load(customerOrderId);  //# orderId - customer Eth address
            if(customerOrder) {
                // TODO this block, update the order
                const contract = SubscriptionApp.bind(Address.fromString(subsAddress));
                let tryGetCustomerOrder = contract.try_getCustomerOrder(event.params.orderId, Address.fromString(customer.id));
                if (!tryGetCustomerOrder.reverted) {
                    customerOrder.approvedPeriodsRemaining = tryGetCustomerOrder.value.value5;
                    customerOrder.trialIntervalsRemaining = tryGetCustomerOrder.value.value6;
                    customerOrder.firstPaymentMadeTimestamp = tryGetCustomerOrder.value.value7;
                    customerOrder.numberOfIntervalsPaid = tryGetCustomerOrder.value.value8;
                    customerOrder.terminated = tryGetCustomerOrder.value.value9;
                    customerOrder.amountPaidToDate = tryGetCustomerOrder.value.value10;
                    customerOrder.lastOutstandingPaymentFailed = false;
                    customerOrder.nextPaymentTimestamp = getNextPaymentTimestamp(order.intervalDuration, tryGetCustomerOrder.value.value7, tryGetCustomerOrder.value.value8);
                    customerOrder.save();
                }

                let customerOrderPaymentHistoryId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(customerOrder.numberOfPaymentsInHistory.toString());
                let customerOrderPaymentHistory = new CustomerOrderPaymentHistory(customerOrderPaymentHistoryId);  //# orderId - customer Eth address - index
                customerOrderPaymentHistory.merchant = order.merchant;
                customerOrderPaymentHistory.customerWallet = customerWallet.id;
                customerOrderPaymentHistory.order = order.id;
                customerOrderPaymentHistory.customerOrder = customerOrder.id;
                customerOrderPaymentHistory.timestamp = event.block.timestamp;
                customerOrderPaymentHistory.txHash = event.transaction.hash;
                customerOrderPaymentHistory.amount = order.chargePerInterval;
                customerOrderPaymentHistory.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
                customerOrderPaymentHistory.description = `Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant} with gas savings mode`;
                customerOrderPaymentHistory.gasSaving = true;
                customerOrderPaymentHistory.feePercentage = BigInt.fromI32(0);
                let tryFee = contract.try_platformFee(Address.fromString(order.merchant));
                if (!tryFee.reverted) {
                    customerOrderPaymentHistory.feePercentage = tryFee.value;
                }

                customerOrderPaymentHistory.save();

                let customerGasSavingDepositHistory = new CustomerGasSavingDepositHistory(customerOrderPaymentHistoryId);  //# orderId - customer Eth address - index
                customerGasSavingDepositHistory.merchant = order.merchant;
                customerGasSavingDepositHistory.customerWallet = customerWallet.id;
                customerGasSavingDepositHistory.order = order.id;
                customerGasSavingDepositHistory.customerOrder = customerOrder.id;
                customerGasSavingDepositHistory.timestamp = event.block.timestamp;
                customerGasSavingDepositHistory.txHash = event.transaction.hash;
                customerGasSavingDepositHistory.merchantAmount = event.params.amount.minus(event.params.feeAmount);
                customerGasSavingDepositHistory.feeAmount = event.params.feeAmount;
                customerGasSavingDepositHistory.save();

                let ownerERC20DepositsBalance = OwnerERC20DepositsBalance.load(order.erc20);
                if(!ownerERC20DepositsBalance){
                    ownerERC20DepositsBalance = new OwnerERC20DepositsBalance(order.erc20);
                    ownerERC20DepositsBalance.erc20 = order.erc20;
                    ownerERC20DepositsBalance.amount = ZERO;
                }
                ownerERC20DepositsBalance.amount =  ownerERC20DepositsBalance.amount.plus(event.params.feeAmount);
                ownerERC20DepositsBalance.save();

                let merchantERC20DepositsBalance = MerchantERC20DepositsBalance.load(order.merchant.concat('-').concat(order.erc20));
                if(!merchantERC20DepositsBalance){
                    merchantERC20DepositsBalance = new MerchantERC20DepositsBalance(order.merchant.concat('-').concat(order.erc20));
                    merchantERC20DepositsBalance.erc20 = order.erc20;
                    merchantERC20DepositsBalance.merchant = order.merchant;
                    merchantERC20DepositsBalance.amount = ZERO;
                }
                merchantERC20DepositsBalance.amount =  merchantERC20DepositsBalance.amount.plus( event.params.amount.minus(event.params.feeAmount));
                merchantERC20DepositsBalance.save();


                let successfulPaymentId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(event.transaction.hash.toHexString());
                let successfulPayment = new SuccessfulPayment(successfulPaymentId);
                successfulPayment.customerWallet = customerWallet.id;
                successfulPayment.merchant = order.merchant;
                successfulPayment.customerOrder = customerOrder.id;
                successfulPayment.order = order.id;
                successfulPayment.txHash = event.transaction.hash;
                successfulPayment.timestamp = event.block.timestamp;
                successfulPayment.amount =  event.params.amount;
                successfulPayment.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
                successfulPayment.description = `Successful Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant}`;
                successfulPayment.save();

                customerOrder.numberOfPaymentsInHistory = customerOrder.numberOfPaymentsInHistory.plus(BigInt.fromI32(1))
                customerOrder.save();

                // Query the erc20 contract as we need to update the customer erc20 approval and balance
                let approvalAndBalanceId = order.erc20.toString().concat("-").concat(customerWallet.id);
                let approvalAndBalance = CustomerERC20ApprovalAndBalance.load(approvalAndBalanceId);
                if (approvalAndBalance) {
                    const erc20Contract = ERC20.bind(Address.fromString(order.erc20));
                    let tryAllowance = erc20Contract.try_allowance(Address.fromString(wallet.id), Address.fromString(subsAddress));
                    if (!tryAllowance.reverted) {
                        approvalAndBalance.currentAllowance = tryAllowance.value;
                    }
                    let tryBalance = erc20Contract.try_balanceOf(Address.fromString(wallet.id));
                    if (!tryBalance.reverted) {
                        approvalAndBalance.currentBalance = tryBalance.value;
                    }
                    approvalAndBalance.save();
                }
            }
            order.totalCharged = order.totalCharged.plus(event.params.amount);
            order.save();
        }

        customer.save();
    }
}

export function handleOrderRenewed(event: OrderRenewed): void {
    let setupResult= setupCustomerAndWallet(
        event.params.customerId.toHexString(),
        event.params.customerAddress.toHexString()
    );

    if (setupResult.customer === null || setupResult.wallet === null || setupResult.customerWallet === null) {
        log.error("One of the entities (Customer, Wallet, CustomerWallet) is null for customerId: {}", [event.params.customerId.toHexString()]);
        return;
    }
    let customer = setupResult.customer;
    let wallet = setupResult.wallet;
    let customerWallet = setupResult.customerWallet;

    if(customerWallet) {
        let order = Order.load(event.params.orderId.toString());
        if (order) {
            let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
            let customerOrder = CustomerOrder.load(customerOrderId);
            if(customerOrder) {
                if (event.params.orderRenewedNotExtended) {
                    // This is the case for an order that was renewed after being cancelled
                    customerOrder.approvedPeriodsRemaining = event.params.approvedPeriodsRemaining;
                    customerOrder.firstPaymentMadeTimestamp = event.params.startTime;
                    customerOrder.numberOfIntervalsPaid = BigInt.fromI32(1);
                    customerOrder.terminated = false;
                    customerOrder.amountPaidToDate = customerOrder.amountPaidToDate.plus(order.chargePerInterval);
                    customerOrder.numberOfPaymentsInHistory = customerOrder.numberOfPaymentsInHistory.plus(BigInt.fromI32(1))
                    customerOrder.lastOutstandingPaymentFailed = false;
                    customerOrder.nextPaymentTimestamp = getNextPaymentTimestamp(order.intervalDuration, event.params.startTime, BigInt.fromI32(1));
                    customerOrder.save();

                    let customerOrderPaymentHistoryId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(customerOrder.numberOfPaymentsInHistory.toString());
                    let customerOrderPaymentHistory = new CustomerOrderPaymentHistory(customerOrderPaymentHistoryId);  //# orderId - customer Eth address - index
                    customerOrderPaymentHistory.merchant = order.merchant;
                    customerOrderPaymentHistory.customerWallet = customerWallet.id;
                    customerOrderPaymentHistory.order = order.id;
                    customerOrderPaymentHistory.customerOrder = customerOrder.id;
                    customerOrderPaymentHistory.timestamp = event.block.timestamp;
                    customerOrderPaymentHistory.txHash = event.transaction.hash;
                    customerOrderPaymentHistory.amount = order.chargePerInterval;
                    customerOrderPaymentHistory.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
                    customerOrderPaymentHistory.description = `Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant} without gas savings mode`;
                    customerOrderPaymentHistory.feePercentage = BigInt.fromI32(0);
                    customerOrderPaymentHistory.gasSaving = false;
                    const contract = SubscriptionApp.bind(Address.fromString(subsAddress));
                    let tryFee = contract.try_platformFee(Address.fromString(order.merchant));
                    if (!tryFee.reverted) {
                        customerOrderPaymentHistory.feePercentage = tryFee.value;
                    }
                    customerOrderPaymentHistory.save();

                    // Add the successful payment here
                    let successfulPaymentId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(event.transaction.hash.toHexString());
                    let successfulPayment = new SuccessfulPayment(successfulPaymentId);
                    successfulPayment.customerWallet = customerWallet.id;
                    successfulPayment.merchant = order.merchant;
                    successfulPayment.customerOrder = customerOrder.id;
                    successfulPayment.order = order.id;
                    successfulPayment.timestamp = event.block.timestamp;
                    successfulPayment.amount =  order.chargePerInterval;
                    successfulPayment.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
                    successfulPayment.description = `Successful Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant}`;
                    successfulPayment.txHash = event.transaction.hash;
                    successfulPayment.save();

                    // Query the erc20 contract as we need to update the customer erc20 approval and balance
                    let approvalAndBalanceId = order.erc20.toString().concat("-").concat(customerWallet.id);
                    let approvalAndBalance = CustomerERC20ApprovalAndBalance.load(approvalAndBalanceId);
                    if (!approvalAndBalance) {
                        approvalAndBalance = new CustomerERC20ApprovalAndBalance(approvalAndBalanceId);
                        approvalAndBalance.erc20 = order.erc20;
                        approvalAndBalance.customerWallet = customerWallet.id;
                    }
                    const erc20Contract = ERC20.bind(Address.fromString(order.erc20));
                    let tryAllowance = erc20Contract.try_allowance(Address.fromString(wallet.id), Address.fromString(subsAddress));
                    if (!tryAllowance.reverted) {
                        approvalAndBalance.currentAllowance = tryAllowance.value;
                    }
                    let tryBalance = erc20Contract.try_balanceOf(Address.fromString(wallet.id));
                    if (!tryBalance.reverted) {
                        approvalAndBalance.currentBalance = tryBalance.value;
                    }
                    approvalAndBalance.save();

                    order.totalCharged = order.totalCharged.plus(order.chargePerInterval);
                    order.save();
                } else {
                    // This is the case for an order that was active so was extended
                    customerOrder.approvedPeriodsRemaining = event.params.approvedPeriodsRemaining;
                    customerOrder.save();

                    // Query the erc20 contract as we need to update the customer erc20 approval and balance
                    let approvalAndBalanceId = order.erc20.toString().concat("-").concat(customerWallet.id);
                    let approvalAndBalance = CustomerERC20ApprovalAndBalance.load(approvalAndBalanceId);
                    if (approvalAndBalance) {
                        const erc20Contract = ERC20.bind(Address.fromString(order.erc20));
                        let tryAllowance = erc20Contract.try_allowance(Address.fromString(wallet.id), Address.fromString(subsAddress));
                        if (!tryAllowance.reverted) {
                            approvalAndBalance.currentAllowance = tryAllowance.value;
                        }
                        let tryBalance = erc20Contract.try_balanceOf(Address.fromString(wallet.id));
                        if (!tryBalance.reverted) {
                            approvalAndBalance.currentBalance = tryBalance.value;
                        }
                        approvalAndBalance.save();
                    }
                }
            }
        }
    }
}

export function handleOrderCancelled(event: OrderCancelled): void {
    let setupResult= setupCustomerAndWallet(
        event.params.customerId.toHexString(),
        event.params.customerAddress.toHexString()
    );

    if (setupResult.customer === null || setupResult.wallet === null || setupResult.customerWallet === null) {
        log.error("One of the entities (Customer, Wallet, CustomerWallet) is null for customerId: {}", [event.params.customerId.toHexString()]);
        return;
    }
    let customer = setupResult.customer;

    if(customer) {
        let order = Order.load(event.params.orderId.toString());
        if (order) {
            let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
            let customerOrder = CustomerOrder.load(customerOrderId);
            if(customerOrder) {
                customerOrder.terminated = true;
                customerOrder.approvedPeriodsRemaining = BigInt.fromI32(0);
                customerOrder.save();
            }
        }
    }
}

export function handleOrderPaused(event: OrderPaused): void {
    let order = Order.load(event.params.orderId.toString());
        if (order) {
            order.paused = event.params.isPaused;
            order.save();
        }
}

// This gets called on order paid out
 export function handleSuccessfulPay(event: SuccessfulPay): void {
     let setupResult= setupCustomerAndWallet(
         event.params.customerId.toHexString(),
         event.params.customerAddress.toHexString()
     );

     if (setupResult.customer === null || setupResult.wallet === null || setupResult.customerWallet === null) {
         log.error("One of the entities (Customer, Wallet, CustomerWallet) is null for customerId: {}", [event.params.customerId.toHexString()]);
         return;
     }
     let customer = setupResult.customer;
     // let wallet = setupResult.wallet;
     // let customerWallet = setupResult.customerWallet;

     if(customer) {
         let order = Order.load(event.params.orderId.toString());
         if (order) {
             let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
             let customerOrder = CustomerOrder.load(customerOrderId);
             if(customerOrder) {
                 let successfulPaymentId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(event.transaction.hash.toHexString());

                 log.info("Successful payment done with id {}", [
                     successfulPaymentId,
                 ]);
//                 let successfulPayment = new SuccessfulPayment(successfulPaymentId);
//                 successfulPayment.customer = customer.id;
//                 successfulPayment.merchant = order.merchant;
//                 successfulPayment.customerOrder = customerOrder.id;
//                 successfulPayment.order = order.id;
//                 successfulPayment.txHash = event.transaction.hash;
//                 successfulPayment.timestamp = event.block.timestamp;
//                 successfulPayment.amount =  order.chargePerInterval;
//                 successfulPayment.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
//                 successfulPayment.description = `Successful Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant}`;
//                 successfulPayment.save();
             }
         }
     }
 }

export function handlePaymentFailure(event: PaymentFailure): void {
    let setupResult= setupCustomerAndWallet(
        event.params.customerId.toHexString(),
        event.params.customerAddress.toHexString()
    );

    if (setupResult.customer === null || setupResult.wallet === null || setupResult.customerWallet === null) {
        log.error("One of the entities (Customer, Wallet, CustomerWallet) is null for customerId: {}", [event.params.customerId.toHexString()]);
        return;
    }
    let customer = setupResult.customer;
    // let wallet = setupResult.wallet;
    let customerWallet = setupResult.customerWallet;

    if(customer) {
        let order = Order.load(event.params.orderId.toString());
        if (order) {
            let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
            let customerOrder = CustomerOrder.load(customerOrderId);
            if(customerOrder) {
                let failedPaymentId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(event.transaction.hash.toHexString());
                let failedPayment = new FailedPayment(failedPaymentId);
                failedPayment.customerWallet = customerWallet.id;
                failedPayment.merchant = order.merchant;
                failedPayment.customerOrder = customerOrder.id;
                failedPayment.order = order.id;
                failedPayment.timestamp = event.block.timestamp;
                failedPayment.txHash = event.transaction.hash;
                failedPayment.amount =  order.chargePerInterval;
                failedPayment.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
                failedPayment.description = `Failed Payment for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant}`;

                // The payment is due, and the payment has failed as well, so we need to indicate that the outstanding payment has failed
                if(customerOrder.nextPaymentTimestamp < event.block.timestamp){
                    customerOrder.lastOutstandingPaymentFailed = true;
                    failedPayment.description = `Failed Payment for outstanding order # ${event.params.orderId.toString()} for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant}`;
                    customerOrder.save();
                }
                failedPayment.save();
            }
        }
    }
}

export function handleOwnerWithdrawERC20(event: OwnerWithdrawERC20): void {
    let ownerERC20DepositsBalance = OwnerERC20DepositsBalance.load(event.params.erc20.toHexString());
    if(ownerERC20DepositsBalance){
        ownerERC20DepositsBalance.amount = BigInt.fromI32(0);
        ownerERC20DepositsBalance.save();

        let ownerERC20Withdrawal = new OwnerWithdrawalHistory(event.transaction.hash.toHexString());
        ownerERC20Withdrawal.amount = event.params.value;
        ownerERC20Withdrawal.timestamp = event.block.timestamp;
        ownerERC20Withdrawal.depositsBalance = ownerERC20DepositsBalance.id;
        ownerERC20Withdrawal.save();
    }
}

export function handleMerchantWithdrawERC20(event: MerchantWithdrawERC20): void {
    let merchantERC20DepositsBalance = MerchantERC20DepositsBalance.load(event.params.merchant.toHexString().concat('-').concat(event.params.erc20.toHexString()));
    if(merchantERC20DepositsBalance){
        merchantERC20DepositsBalance.amount = BigInt.fromI32(0);
        merchantERC20DepositsBalance.save();

        let merchantERC20Withdrawal = new MerchantWithdrawalHistory(event.transaction.hash.toHexString());
        merchantERC20Withdrawal.amount = event.params.value;
        merchantERC20Withdrawal.timestamp = event.block.timestamp;
        merchantERC20Withdrawal.depositsBalance = merchantERC20DepositsBalance.id;
        merchantERC20Withdrawal.save();
    }
}

export function handleOrderSetMerchantDefaultNumberOfOrderIntervals(event: OrderSetMerchantDefaultNumberOfOrderIntervals): void {
    let order = new Order(event.params.orderId.toString());
    if(order){
        order.merchantDefaultNumberOfOrderIntervals = event.params.defaultNumberOfOrderIntervals;
        order.save();
    }
}

export function handleExtraBudgetLogged(event: ExtraBudgetLogged): void {
    let setupResult= setupCustomerAndWallet(
        event.params.customerId.toHexString(),
        event.params.customerAddress.toHexString()
    );

    if (setupResult.customer === null || setupResult.wallet === null || setupResult.customerWallet === null) {
        log.error("One of the entities (Customer, Wallet, CustomerWallet) is null for customerId: {}", [event.params.customerId.toHexString()]);
        return;
    }

    let customerWallet = setupResult.customerWallet;
    let indexOfRequest = event.params.index;

    let order = Order.load(event.params.orderId.toString());
    if(order){
        let extraBudgetRequestId = order.id.concat("-").concat(indexOfRequest.toString());
        let request = new ExtraBudgetRequest(extraBudgetRequestId);
        if(order && customerWallet && indexOfRequest) {
            request.customerWallet = customerWallet.id;
            request.index = indexOfRequest;
            request.order = order.id;
            request.pendingPeriods = event.params.pendingPeriods;
            request.extraAmount = event.params.extraAmount;
            request.status = "PENDING";
            request.requestTxHash = event.transaction.hash;
            request.save();
        }
    }
}

export function handleExtraBudgetPaymentProcessed(event: ExtraBudgetPaymentProcessed): void {
    // Create new or load a budget paid out object that will act to keep track of specific payments
    let indexOfRequest = event.params.index;

    let order = Order.load(event.params.orderId.toString());
    if(order){
        let extraBudgetRequestId = order.id.concat("-").concat(indexOfRequest.toString());

        let paidOutEntity = ExtraBudgetPaidOutRecord.load(event.transaction.hash.toHexString());
        if (!paidOutEntity) {
            paidOutEntity = new ExtraBudgetPaidOutRecord(event.transaction.hash.toHexString());
            paidOutEntity.order = order.id;
            paidOutEntity.merchant = order.merchant;
            // Total amount filled out later
            // Start index filled out later
            // End index filled out later
            paidOutEntity.save();
        }

        let request = ExtraBudgetRequest.load(extraBudgetRequestId);
        if(request){
            request.status = "PAID";
            // request.requestTxHash = event.transaction.hash; // The request tx hash is from the original tx, the settle tx hash is id of paid out entity
            request.settleTransaction = paidOutEntity.id;
            request.save();
        }
    }
}

export function handleExtraBudgetPaidOut(event: ExtraBudgetPaidOut): void {
    let paidOutEntity = ExtraBudgetPaidOutRecord.load(event.transaction.hash.toHexString());
    if (paidOutEntity) {
        paidOutEntity.totalAmount = event.params.amount;
        paidOutEntity.startIndex = event.params.startPaymentIndex;
        paidOutEntity.endIndex = event.params.endPaymentIndex;
        paidOutEntity.save();
    }
}

export function handleExtraBudgetRefunded(event: ExtraBudgetRefunded): void {
    let indexOfRequest = event.params.index;

    let order = Order.load(event.params.orderId.toString());
    if(order) {
        let extraBudgetRequestId = order.id.concat("-").concat(indexOfRequest.toString());

        let request = ExtraBudgetRequest.load(extraBudgetRequestId);

        let refundRecord = new ExtraBudgetRefundedRecord(event.transaction.hash.toHexString());
        if(refundRecord && request){
            refundRecord.order = order.id;
            refundRecord.merchant = order.merchant;
            refundRecord.customerWallet = request.customerWallet;
            refundRecord.refundedAmount = event.params.extraAmount;
            refundRecord.request = request.id;
            refundRecord.save();

            request.status = "REFUNDED";
            request.refundTransaction = refundRecord.id;
            request.save();
        }
    }
}

export function handleSetMerchantSpecificExtraBudgetLockTime(event: SetMerchantSpecificExtraBudgetLockTime): void {
    // For a merchant, need to set the specific extra budget lock time custom for them if it exists. This goes on a merchant object
    let merchant = Merchant.load(event.params.merchant.toHexString());
    if(merchant){
        merchant.merchantSpecificExtraBudgetLockTime = event.params.customLockTime;
        merchant.save();
    }
}
