import { BigInt, Address } from "@graphprotocol/graph-ts/index";

import {
    MerchantWithdrawERC20,
    OrderAccepted,
    OrderCancelled,

    OrderCreated,
    OrderPaidOut, OrderPaidOutGasSavingMode,
    OrderPaused,
    OrderRenewed,
    OwnerWithdrawERC20,
    PaymentFailure,
    SubscriptionApp,
    SuccessfulPay,
} from "../generated/SubscriptionApp/SubscriptionApp";

import {
    Customer,
    CustomerERC20ApprovalAndBalance,
    CustomerGasSavingDepositHistory,
    CustomerOrder,
    CustomerOrderPaymentHistory,
    ERC20Token,
    FailedPayment,
    Merchant, MerchantERC20DepositsBalance, MerchantWithdrawalHistory,
    Order, OwnerERC20DepositsBalance, OwnerWithdrawalHistory,
    SuccessfulPayment
} from "../generated/schema";

import {ERC20} from "../generated/SubscriptionApp/ERC20";
import {ZERO} from "./constants";
const goerliAddress = "0x56603e92fffa43b198c5a4c4bf3b6b90fac8144e"; //TODO

export function handleOrderCreated(event: OrderCreated): void {
  let order = new Order(event.params.orderId.toString());
  let merchant = Merchant.load(event.params.merchant.toHexString());
  if(!merchant){
      merchant = new Merchant(event.params.merchant.toHexString());
  }

  order.chargePerInterval = event.params.chargePerInterval;
  order.paused = false;
  order.merchant = merchant.id;

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

  order.save();
  merchant.save();
}

function getNextPaymentTimestamp(intervalDuration: string, firstTimestamp: BigInt, numberOfIntervalsPaid: BigInt): BigInt{
    const contract = SubscriptionApp.bind(Address.fromString(goerliAddress));
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

export function handleOrderAccepted(event: OrderAccepted): void {
    let customer = Customer.load(event.params.customer.toHexString());
    if(!customer){
        customer = new Customer(event.params.customer.toHexString());
    }
    customer.save();

    // Get the order
    let order = Order.load(event.params.orderId.toString());

    // Setup the customer order and the payment info
    if(order) {
        let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
        let customerOrder = new CustomerOrder(customerOrderId);  //# orderId - customer Eth address
        customerOrder.order = order.id;
        customerOrder.customer = customer.id;
        customerOrder.merchant = order.merchant;
        customerOrder.approvedPeriodsRemaining = event.params.approvedPeriodsRemaining;
        customerOrder.firstPaymentMadeTimestamp = event.params.startTime;
        customerOrder.numberOfIntervalsPaid = BigInt.fromI32(1);
        customerOrder.terminated = false;
        customerOrder.amountPaidToDate = order.chargePerInterval;
        customerOrder.numberOfPaymentsInHistory = BigInt.fromI32(1);
        customerOrder.lastOutstandingPaymentFailed = false;
        customerOrder.nextPaymentTimestamp = getNextPaymentTimestamp(order.intervalDuration, event.params.startTime, BigInt.fromI32(1));
        customerOrder.save();

        let customerOrderPaymentHistoryId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-0");
        let customerOrderPaymentHistory = new CustomerOrderPaymentHistory(customerOrderPaymentHistoryId);  //# orderId - customer Eth address - index
        customerOrderPaymentHistory.merchant = order.merchant;
        customerOrderPaymentHistory.customer = customer.id;
        customerOrderPaymentHistory.order = order.id;
        customerOrderPaymentHistory.customerOrder = customerOrder.id;
        customerOrderPaymentHistory.timestamp = event.block.timestamp;
        customerOrderPaymentHistory.txHash = event.transaction.hash;
        customerOrderPaymentHistory.amount =  order.chargePerInterval;
        customerOrderPaymentHistory.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
        customerOrderPaymentHistory.description = `Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant} without gas savings mode`;
        customerOrderPaymentHistory.feePercentage = BigInt.fromI32(0);
        customerOrderPaymentHistory.gasSaving = false;
        const contract = SubscriptionApp.bind(Address.fromString(goerliAddress));
        let tryFee = contract.try_platformFee(Address.fromString(order.merchant));
        if (!tryFee.reverted) {
                customerOrderPaymentHistory.feePercentage = tryFee.value;
          }
        customerOrderPaymentHistory.save();

        // Add the successful payment here
        let successfulPaymentId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(event.transaction.hash.toHexString());
        let successfulPayment = new SuccessfulPayment(successfulPaymentId);
        successfulPayment.customer = customer.id;
        successfulPayment.merchant = order.merchant;
        successfulPayment.customerOrder = customerOrder.id;
        successfulPayment.order = order.id;
        successfulPayment.txHash = event.transaction.hash;
        successfulPayment.timestamp = event.block.timestamp;
        successfulPayment.amount =  order.chargePerInterval;
        successfulPayment.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
        successfulPayment.description = `Successful Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant}`;
        successfulPayment.save();

        // Query the erc20 contract as we need to update the customer erc20 approval and balance
        let approvalAndBalanceId = order.erc20.toString().concat("-").concat(customer.id);
        let approvalAndBalance = CustomerERC20ApprovalAndBalance.load(approvalAndBalanceId);
        if(!approvalAndBalance){
            approvalAndBalance = new CustomerERC20ApprovalAndBalance(approvalAndBalanceId);
            approvalAndBalance.erc20 = order.erc20;
            approvalAndBalance.customer = customer.id;
        }
         const erc20Contract = ERC20.bind(Address.fromString(order.erc20));
         let tryAllowance = erc20Contract.try_allowance(Address.fromString(customer.id), Address.fromString(goerliAddress));
         if (!tryAllowance.reverted) {
                approvalAndBalance.currentAllowance = tryAllowance.value;
         }
         let tryBalance = erc20Contract.try_balanceOf(Address.fromString(customer.id));
         if (!tryBalance.reverted) {
                approvalAndBalance.currentBalance = tryBalance.value;
         }
        approvalAndBalance.save();

        order.save();
    }
}

export function handleOrderPaidOut(event: OrderPaidOut): void {
 let customer = Customer.load(event.params.customer.toHexString());
    if(customer) {
        // Get the order
        let order = Order.load(event.params.orderId.toString());

        // Setup the customer order and the payment info
        if (order) {
            let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
            let customerOrder = CustomerOrder.load(customerOrderId);  //# orderId - customer Eth address
            if(customerOrder) {
                // TODO this block, update the order
                const contract = SubscriptionApp.bind(Address.fromString(goerliAddress));
                let tryGetCustomerOrder = contract.try_getCustomerOrder(event.params.orderId, Address.fromString(customer.id));
                if (!tryGetCustomerOrder.reverted) {

                    customerOrder.approvedPeriodsRemaining = tryGetCustomerOrder.value.value1;
                    customerOrder.firstPaymentMadeTimestamp = tryGetCustomerOrder.value.value2;
                    customerOrder.numberOfIntervalsPaid = tryGetCustomerOrder.value.value3;
                    customerOrder.terminated = tryGetCustomerOrder.value.value4;
                    customerOrder.amountPaidToDate = tryGetCustomerOrder.value.value5;
                    customerOrder.lastOutstandingPaymentFailed = false;
                    customerOrder.nextPaymentTimestamp = getNextPaymentTimestamp(order.intervalDuration, tryGetCustomerOrder.value.value2, tryGetCustomerOrder.value.value3);
                    customerOrder.save();
                }

                let customerOrderPaymentHistoryId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(customerOrder.numberOfPaymentsInHistory.toString());
                let customerOrderPaymentHistory = new CustomerOrderPaymentHistory(customerOrderPaymentHistoryId);  //# orderId - customer Eth address - index
                customerOrderPaymentHistory.merchant = order.merchant;
                customerOrderPaymentHistory.customer = customer.id;
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

                customerOrder.numberOfPaymentsInHistory = customerOrder.numberOfPaymentsInHistory.plus(BigInt.fromI32(1))
                customerOrder.save();

                // Query the erc20 contract as we need to update the customer erc20 approval and balance
                let approvalAndBalanceId = order.erc20.toString().concat("-").concat(customer.id);
                let approvalAndBalance = CustomerERC20ApprovalAndBalance.load(approvalAndBalanceId);
                if (approvalAndBalance) {
                    const erc20Contract = ERC20.bind(Address.fromString(order.erc20));
                    let tryAllowance = erc20Contract.try_allowance(Address.fromString(customer.id), Address.fromString(goerliAddress));
                    if (!tryAllowance.reverted) {
                        approvalAndBalance.currentAllowance = tryAllowance.value;
                    }
                    let tryBalance = erc20Contract.try_balanceOf(Address.fromString(customer.id));
                    if (!tryBalance.reverted) {
                        approvalAndBalance.currentBalance = tryBalance.value;
                    }
                    approvalAndBalance.save();
                }
            }
            order.save();
        }

        customer.save();
    }
}

export function handleOrderPaidOutGasSavingMode (event: OrderPaidOutGasSavingMode): void {
 let customer = Customer.load(event.params.customer.toHexString());
    if(customer) {
        // Get the order
        let order = Order.load(event.params.orderId.toString());

        // Setup the customer order and the payment info
        if (order) {
            let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
            let customerOrder = CustomerOrder.load(customerOrderId);  //# orderId - customer Eth address
            if(customerOrder) {
                // TODO this block, update the order
                const contract = SubscriptionApp.bind(Address.fromString(goerliAddress));
                let tryGetCustomerOrder = contract.try_getCustomerOrder(event.params.orderId, Address.fromString(customer.id));
                if (!tryGetCustomerOrder.reverted) {
                    customerOrder.approvedPeriodsRemaining = tryGetCustomerOrder.value.value1;
                    customerOrder.firstPaymentMadeTimestamp = tryGetCustomerOrder.value.value2;
                    customerOrder.numberOfIntervalsPaid = tryGetCustomerOrder.value.value3;
                    customerOrder.terminated = tryGetCustomerOrder.value.value4;
                    customerOrder.amountPaidToDate = tryGetCustomerOrder.value.value5;
                    customerOrder.lastOutstandingPaymentFailed = false;
                    customerOrder.nextPaymentTimestamp = getNextPaymentTimestamp(order.intervalDuration, tryGetCustomerOrder.value.value2, tryGetCustomerOrder.value.value3);
                    customerOrder.save();
                }

                let customerOrderPaymentHistoryId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(customerOrder.numberOfPaymentsInHistory.toString());
                let customerOrderPaymentHistory = new CustomerOrderPaymentHistory(customerOrderPaymentHistoryId);  //# orderId - customer Eth address - index
                customerOrderPaymentHistory.merchant = order.merchant;
                customerOrderPaymentHistory.customer = customer.id;
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

                let customerGasSavingDepositHistory = new CustomerGasSavingDepositHistory(customerOrderPaymentHistoryId);  //# orderId - customer Eth address - index
                customerGasSavingDepositHistory.merchant = order.merchant;
                customerGasSavingDepositHistory.customer = customer.id;
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


                customerOrderPaymentHistory.save();

                customerOrder.numberOfPaymentsInHistory = customerOrder.numberOfPaymentsInHistory.plus(BigInt.fromI32(1))
                customerOrder.save();

                // Query the erc20 contract as we need to update the customer erc20 approval and balance
                let approvalAndBalanceId = order.erc20.toString().concat("-").concat(customer.id);
                let approvalAndBalance = CustomerERC20ApprovalAndBalance.load(approvalAndBalanceId);
                if (approvalAndBalance) {
                    const erc20Contract = ERC20.bind(Address.fromString(order.erc20));
                    let tryAllowance = erc20Contract.try_allowance(Address.fromString(customer.id), Address.fromString(goerliAddress));
                    if (!tryAllowance.reverted) {
                        approvalAndBalance.currentAllowance = tryAllowance.value;
                    }
                    let tryBalance = erc20Contract.try_balanceOf(Address.fromString(customer.id));
                    if (!tryBalance.reverted) {
                        approvalAndBalance.currentBalance = tryBalance.value;
                    }
                    approvalAndBalance.save();
                }
            }
            order.save();
        }

        customer.save();
    }
}

export function handleOrderRenewed(event: OrderRenewed): void {
    let customer = Customer.load(event.params.customer.toHexString());
    if(customer) {
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
                    customerOrderPaymentHistory.customer = customer.id;
                    customerOrderPaymentHistory.order = order.id;
                    customerOrderPaymentHistory.customerOrder = customerOrder.id;
                    customerOrderPaymentHistory.timestamp = event.block.timestamp;
                    customerOrderPaymentHistory.txHash = event.transaction.hash;
                    customerOrderPaymentHistory.amount = order.chargePerInterval;
                    customerOrderPaymentHistory.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
                    customerOrderPaymentHistory.description = `Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant} without gas savings mode`;
                    customerOrderPaymentHistory.feePercentage = BigInt.fromI32(0);
                    customerOrderPaymentHistory.gasSaving = false;
                    const contract = SubscriptionApp.bind(Address.fromString(goerliAddress));
                    let tryFee = contract.try_platformFee(Address.fromString(order.merchant));
                    if (!tryFee.reverted) {
                        customerOrderPaymentHistory.feePercentage = tryFee.value;
                    }
                    customerOrderPaymentHistory.save();

                    // Add the successful payment here
                    let successfulPaymentId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(event.transaction.hash.toHexString());
                    let successfulPayment = new SuccessfulPayment(successfulPaymentId);
                    successfulPayment.customer = customer.id;
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
                    let approvalAndBalanceId = order.erc20.toString().concat("-").concat(customer.id);
                    let approvalAndBalance = CustomerERC20ApprovalAndBalance.load(approvalAndBalanceId);
                    if (!approvalAndBalance) {
                        approvalAndBalance = new CustomerERC20ApprovalAndBalance(approvalAndBalanceId);
                        approvalAndBalance.erc20 = order.erc20;
                        approvalAndBalance.customer = customer.id;
                    }
                    const erc20Contract = ERC20.bind(Address.fromString(order.erc20));
                    let tryAllowance = erc20Contract.try_allowance(Address.fromString(customer.id), Address.fromString(goerliAddress));
                    if (!tryAllowance.reverted) {
                        approvalAndBalance.currentAllowance = tryAllowance.value;
                    }
                    let tryBalance = erc20Contract.try_balanceOf(Address.fromString(customer.id));
                    if (!tryBalance.reverted) {
                        approvalAndBalance.currentBalance = tryBalance.value;
                    }
                    approvalAndBalance.save();

                    order.save();
                } else {
                    // This is the case for an order that was active so was extended
                    customerOrder.approvedPeriodsRemaining = event.params.approvedPeriodsRemaining;
                    customerOrder.save();

                    // Query the erc20 contract as we need to update the customer erc20 approval and balance
                    let approvalAndBalanceId = order.erc20.toString().concat("-").concat(customer.id);
                    let approvalAndBalance = CustomerERC20ApprovalAndBalance.load(approvalAndBalanceId);
                    if (approvalAndBalance) {
                        const erc20Contract = ERC20.bind(Address.fromString(order.erc20));
                        let tryAllowance = erc20Contract.try_allowance(Address.fromString(customer.id), Address.fromString(goerliAddress));
                        if (!tryAllowance.reverted) {
                            approvalAndBalance.currentAllowance = tryAllowance.value;
                        }
                        let tryBalance = erc20Contract.try_balanceOf(Address.fromString(customer.id));
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
    let customer = Customer.load(event.params.customer.toHexString());
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
    let customer = Customer.load(event.params.customer.toHexString());
    if(customer) {
        let order = Order.load(event.params.orderId.toString());
        if (order) {
            let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
            let customerOrder = CustomerOrder.load(customerOrderId);
            if(customerOrder) {
                let successfulPaymentId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(event.transaction.hash.toHexString());
                let successfulPayment = new SuccessfulPayment(successfulPaymentId);
                successfulPayment.customer = customer.id;
                successfulPayment.merchant = order.merchant;
                successfulPayment.customerOrder = customerOrder.id;
                successfulPayment.order = order.id;
                successfulPayment.txHash = event.transaction.hash;
                successfulPayment.timestamp = event.block.timestamp;
                successfulPayment.amount =  order.chargePerInterval;
                successfulPayment.tokenSymbol = ERC20Token.load(order.erc20)!.symbol;
                successfulPayment.description = `Successful Payment made for ${order.chargePerInterval} ${ERC20Token.load(order.erc20)!.symbol} (${ERC20Token.load(order.erc20)!.name}) Tokens from ${customer.id} to ${order.merchant}`;
                successfulPayment.save();
            }
        }
    }
}

export function handlePaymentFailure(event: PaymentFailure): void {
    let customer = Customer.load(event.params.customer.toHexString());
    if(customer) {
        let order = Order.load(event.params.orderId.toString());
        if (order) {
            let customerOrderId = event.params.orderId.toString().concat("-").concat(customer.id);
            let customerOrder = CustomerOrder.load(customerOrderId);
            if(customerOrder) {
                let failedPaymentId = event.params.orderId.toString().concat("-").concat(customer.id).concat("-").concat(event.transaction.hash.toHexString());
                let failedPayment = new FailedPayment(failedPaymentId);
                failedPayment.customer = customer.id;
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

