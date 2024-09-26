pragma solidity ^0.8.15;

// UNISUB IO

//
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/IERC20.sol)
/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

library BokkyPooBahsDateTimeLibrary {

    uint constant SECONDS_PER_DAY = 24 * 60 * 60;
    uint constant SECONDS_PER_HOUR = 60 * 60;
    uint constant SECONDS_PER_MINUTE = 60;
    int constant OFFSET19700101 = 2440588;

    uint constant DOW_MON = 1;
    uint constant DOW_TUE = 2;
    uint constant DOW_WED = 3;
    uint constant DOW_THU = 4;
    uint constant DOW_FRI = 5;
    uint constant DOW_SAT = 6;
    uint constant DOW_SUN = 7;

    // ------------------------------------------------------------------------
    // Calculate the number of days from 1970/01/01 to year/month/day using
    // the date conversion algorithm from
    //   http://aa.usno.navy.mil/faq/docs/JD_Formula.php
    // and subtracting the offset 2440588 so that 1970/01/01 is day 0
    //
    // days = day
    //      - 32075
    //      + 1461 * (year + 4800 + (month - 14) / 12) / 4
    //      + 367 * (month - 2 - (month - 14) / 12 * 12) / 12
    //      - 3 * ((year + 4900 + (month - 14) / 12) / 100) / 4
    //      - offset
    // ------------------------------------------------------------------------
    function _daysFromDate(uint year, uint month, uint day) internal pure returns (uint _days) {
        require(year >= 1970);
        int _year = int(year);
        int _month = int(month);
        int _day = int(day);

        int __days = _day
        - 32075
        + 1461 * (_year + 4800 + (_month - 14) / 12) / 4
        + 367 * (_month - 2 - (_month - 14) / 12 * 12) / 12
        - 3 * ((_year + 4900 + (_month - 14) / 12) / 100) / 4
        - OFFSET19700101;

        _days = uint(__days);
    }

    // ------------------------------------------------------------------------
    // Calculate year/month/day from the number of days since 1970/01/01 using
    // the date conversion algorithm from
    //   http://aa.usno.navy.mil/faq/docs/JD_Formula.php
    // and adding the offset 2440588 so that 1970/01/01 is day 0
    //
    // int L = days + 68569 + offset
    // int N = 4 * L / 146097
    // L = L - (146097 * N + 3) / 4
    // year = 4000 * (L + 1) / 1461001
    // L = L - 1461 * year / 4 + 31
    // month = 80 * L / 2447
    // dd = L - 2447 * month / 80
    // L = month / 11
    // month = month + 2 - 12 * L
    // year = 100 * (N - 49) + year + L
    // ------------------------------------------------------------------------
    function _daysToDate(uint _days) internal pure returns (uint year, uint month, uint day) {
        int __days = int(_days);

        int L = __days + 68569 + OFFSET19700101;
        int N = 4 * L / 146097;
        L = L - (146097 * N + 3) / 4;
        int _year = 4000 * (L + 1) / 1461001;
        L = L - 1461 * _year / 4 + 31;
        int _month = 80 * L / 2447;
        int _day = L - 2447 * _month / 80;
        L = _month / 11;
        _month = _month + 2 - 12 * L;
        _year = 100 * (N - 49) + _year + L;

        year = uint(_year);
        month = uint(_month);
        day = uint(_day);
    }


    function _isLeapYear(uint year) internal pure returns (bool leapYear) {
        leapYear = ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
    }

    function _getDaysInMonth(uint year, uint month) internal pure returns (uint daysInMonth) {
        if (month == 1 || month == 3 || month == 5 || month == 7 || month == 8 || month == 10 || month == 12) {
            daysInMonth = 31;
        } else if (month != 2) {
            daysInMonth = 30;
        } else {
            daysInMonth = _isLeapYear(year) ? 29 : 28;
        }
    }


    function addYears(uint timestamp, uint _years) internal pure returns (uint newTimestamp) {
        uint year;
        uint month;
        uint day;
        (year, month, day) = _daysToDate(timestamp / SECONDS_PER_DAY);
        year += _years;
        uint daysInMonth = _getDaysInMonth(year, month);
        if (day > daysInMonth) {
            day = daysInMonth;
        }
        newTimestamp = _daysFromDate(year, month, day) * SECONDS_PER_DAY + timestamp % SECONDS_PER_DAY;
        require(newTimestamp >= timestamp);
    }
    function addMonths(uint timestamp, uint _months) internal pure returns (uint newTimestamp) {
        uint year;
        uint month;
        uint day;
        (year, month, day) = _daysToDate(timestamp / SECONDS_PER_DAY);
        month += _months;
        year += (month - 1) / 12;
        month = (month - 1) % 12 + 1;
        uint daysInMonth = _getDaysInMonth(year, month);
        if (day > daysInMonth) {
            day = daysInMonth;
        }
        newTimestamp = _daysFromDate(year, month, day) * SECONDS_PER_DAY + timestamp % SECONDS_PER_DAY;
        require(newTimestamp >= timestamp);
    }


    function diffYears(uint fromTimestamp, uint toTimestamp) internal pure returns (uint _years) {
        require(fromTimestamp <= toTimestamp);
        uint fromYear;
        uint fromMonth;
        uint fromDay;
        uint toYear;
        uint toMonth;
        uint toDay;
        (fromYear, fromMonth, fromDay) = _daysToDate(fromTimestamp / SECONDS_PER_DAY);
        (toYear, toMonth, toDay) = _daysToDate(toTimestamp / SECONDS_PER_DAY);
        _years = toYear - fromYear;
    }
    function diffMonths(uint fromTimestamp, uint toTimestamp) internal pure returns (uint _months) {
        require(fromTimestamp <= toTimestamp);
        uint fromYear;
        uint fromMonth;
        uint fromDay;
        uint toYear;
        uint toMonth;
        uint toDay;
        (fromYear, fromMonth, fromDay) = _daysToDate(fromTimestamp / SECONDS_PER_DAY);
        (toYear, toMonth, toDay) = _daysToDate(toTimestamp / SECONDS_PER_DAY);
        _months = toYear * 12 + toMonth - fromYear * 12 - fromMonth;
    }
    function diffDays(uint fromTimestamp, uint toTimestamp) internal pure returns (uint _days) {
        require(fromTimestamp <= toTimestamp);
        _days = (toTimestamp - fromTimestamp) / SECONDS_PER_DAY;
    }
    function diffHours(uint fromTimestamp, uint toTimestamp) internal pure returns (uint _hours) {
        require(fromTimestamp <= toTimestamp);
        _hours = (toTimestamp - fromTimestamp) / SECONDS_PER_HOUR;
    }
    function diffMinutes(uint fromTimestamp, uint toTimestamp) internal pure returns (uint _minutes) {
        require(fromTimestamp <= toTimestamp);
        _minutes = (toTimestamp - fromTimestamp) / SECONDS_PER_MINUTE;
    }
    function diffSeconds(uint fromTimestamp, uint toTimestamp) internal pure returns (uint _seconds) {
        require(fromTimestamp <= toTimestamp);
        _seconds = toTimestamp - fromTimestamp;
    }
}

/**
 * @dev Interface of the ERC165 standard, as defined in the
 * https://eips.ethereum.org/EIPS/eip-165[EIP].
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others ({ERC165Checker}).
 *
 * For an implementation, see {ERC165}.
 */
interface IERC165 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * https://eips.ethereum.org/EIPS/eip-165#how-interfaces-are-identified[EIP section]
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

contract SubscriptionApp {
    bool initialized;
    address public owner;
    address public operator;
    uint256 public defaultPlatformFee;
    uint256 public nextOrder;

    mapping(bytes32 => address) public customerIdToAddress;

    // Events
    event OrderCreated(
        uint256 orderId,
        address merchant,
        uint256 chargePerInterval,
        uint256 extraBudgetPerInterval,
        uint256 startTime,
        uint256 intervalDuration,
        address erc20,
        uint256 merchantDefaultNumberOfOrderIntervals,
        uint256 trialIntervals
    );

    event OrderAccepted(
        uint256 orderId,
        bytes32 customerId,
        address customerAddress,
        uint256 startTime,
        uint256 extraBudgetPerInterval,
        uint256 approvedPeriodsRemaining,
        uint256 trialIntervalsRemaining
    );

    event OrderPaidOut(
        uint256 orderId,
        bytes32 customerId,
        uint256 amount,
        uint256 feeAmount,
        uint256 timestamp,
        address executor // Merchant or owner address that paid out
    );

    event ExtraBudgetLogged(
        uint256 orderId,
        bytes32 customerId,
        address customerAddress,
        uint256 extraAmount,
        uint256 pendingPeriods,
        uint256 index
    );

    event ExtraBudgetPaymentProcessed(
        uint256 orderId,
        bytes32 customerId,
        address customerAddress,
        uint256 amount,
        uint256 index
    );

    event ExtraBudgetPaidOut(
        uint256 orderId,
        uint256 amount,
        uint256 startPaymentIndex,
        uint256 endPaymentIndex
    );

    event ExtraBudgetRefunded(
        uint256 orderId,
        bytes32 customerId,
        address customerAddress,
        uint256 extraAmount, // Refunded amount
        uint256 index
    );

    event OrderPaidOutGasSavingMode(
        uint256 orderId,
        bytes32 customerId,
        uint256 amount,
        uint256 feeAmount,
        uint256 timestamp,
        address executor // Merchant or owner address that paid out
    );

    event OrderRenewed(
        uint256 orderId,
        bytes32 customerId,
        address customerAddress,
        uint256 startTime,
        uint256 approvedPeriodsRemaining,
        bool orderRenewedNotExtended
    );

    event OrderCancelled(
        uint256 orderId,
        bytes32 customerId,
        address customerAddress
    );

    event OrderPaused(
        uint256 orderId,
        bool isPaused,
        address whoPausedIt
    );

    event OrderSetMerchantDefaultNumberOfOrderIntervals(
        uint256 orderId,
        uint256 defaultNumberOfOrderIntervals,
        address whoSetIt
    );

    event SuccessfulPay(uint256 orderId,
                        bytes32 customerId,
                        address customerAddress);

    event PaymentFailureBytes(bytes someData,
        uint256 orderId,
        bytes32 customerId,
        address customerAddress);

    event PaymentFailure(string revertString,
        uint256 orderId,
        bytes32 customerId,
        address customerAddress);

    event SetMerchantSpecificPlatformFee(address merchant, uint256 customPlatformFee, bool activated);
    event SetMerchantSpecificExtraBudgetLockTime(address merchant, uint256 customLockTime);

    event MerchantWithdrawERC20(address erc20, address merchant, uint256 value);
    event OwnerWithdrawERC20(address erc20, uint256 value);
    event ChangeOwner(address newOwner);
    event ChangeOperator(address operator);

    // Structs

    struct CustomerOrder {
        bytes32 customerId;
        address customerAddress;
        uint256 extraBudgetPerInterval;
        uint256 extraBudgetUsed;
        uint256 extraBudgetLifetime;
        uint256 approvedPeriodsRemaining;
        uint256 trialIntervalsRemaining;
        uint256 firstPaymentMadeTimestamp;
        uint256 numberOfIntervalsPaid;
        bool terminated;
        uint256 amountPaidToDate;
    }

    struct Order {
        uint256 orderId;
        address merchant;
        uint256 chargePerInterval;
        uint256 extraBudgetPerInterval;
        uint256 startTime;
        uint256 intervalDuration;
        address erc20;
        bool paused;
        uint256 trialIntervals;
        uint256 merchantDefaultNumberOfOrderIntervals;
        mapping(bytes32 => CustomerOrder) customerOrders;
    }
    struct PendingExtraBudgetPayment {
        bytes32 customerId;
        address customerAddress;
        uint256 timestamp;
        uint256 extraAmount;
        bool processed;
        bool refunded;
    }

    /// @notice order id to order
    mapping(uint256 => Order) public orders;

    mapping(uint256 => mapping(bytes32=> uint256[])) public customerHistoryTimestamps;
    mapping(uint256 => mapping(bytes32=> uint256[])) public customerHistoryAmounts;
    mapping(uint256 => mapping(bytes32=> uint256[])) public customerHistoryFeePercentages;

    mapping(address => bool) public customPlatformFeeAssigned;
    mapping(address => uint256) public customPlatformFee;

    mapping(address => uint256) public pendingOwnerWithdrawalAmountByToken;
    mapping(address => mapping (address => uint256)) public pendingMerchantWithdrawalAmountByMerchantAndToken;

    // Order id ->  list of pending extra budget payments
    mapping(uint256 => PendingExtraBudgetPayment[]) public pendingExtraBudgetPaymentListByOrderAndCustomer;
    uint256 public lockDownPeriodExtraBudgetPayment;
    mapping(address => uint256) public customLockDownPeriodExtraBudgetPaymentMerchants;

    modifier onlyOwner() {
        require(owner == msg.sender, "Caller is not the owner");
        _;
    }

    constructor(){
    }

    function initialize(uint256 _defaultPlatformFee) public{
        if(!initialized){
            defaultPlatformFee = _defaultPlatformFee;
            owner = msg.sender;
            operator = address(0);
            nextOrder = 0;
            lockDownPeriodExtraBudgetPayment = 604800; // 7 days in seconds
            initialized = true;
        }
    }

    /// @dev ChangeOwner
    /// @param newOwner The new Owner
    function changeOwner(address newOwner) public onlyOwner {
        require(newOwner != address(0), 'Cannot change owner to 0');
        owner = newOwner;
        emit ChangeOwner(newOwner);
    }

    /// @dev ChangeOperator
    /// @param _operator The new Operator authorized to process payments
    function changeOperator(address _operator) public onlyOwner {
        operator = _operator;
        emit ChangeOperator(_operator);
    }

    /// @dev ChangeDefaultPlatformFee
    /// @param _defaultPlatformFee The new fee for using the platform
    function changeDefaultPlatformFee(uint _defaultPlatformFee) public onlyOwner {
        defaultPlatformFee = _defaultPlatformFee;
    }

    /// @dev SetMerchantSpecificPlatformFee
    /// @param _merchant The merchant
    /// @param _platformFee Custom platform fee for merchant
    /// @param _activated Fee activated with custom platform fee or deactivated
    function setMerchantSpecificPlatformFee(address _merchant, uint256 _platformFee, bool _activated) public onlyOwner {
        if(_activated){
            customPlatformFeeAssigned[_merchant] = true;
            customPlatformFee[_merchant] = _platformFee;
        } else{
            // Basically, turn off specific platform fee
            // Note this means that the _platformFee argument is irrelevant, the default will be used
            customPlatformFeeAssigned[_merchant] = false;
            customPlatformFee[_merchant] = 0;
        }
        emit SetMerchantSpecificPlatformFee(_merchant, _platformFee, _activated);
    }
    /// @dev SetMerchantSpecificExtraBudgetLockTime
    /// @param _merchant The merchant that will have extra budget lock in time modified
    /// @param _lockTimeSeconds Seconds to hold on to extra budget expenditure before allowing merchant to withdraw it
    function setMerchantSpecificExtraBudgetLockTime(address _merchant, uint256 _lockTimeSeconds) public onlyOwner {
        customLockDownPeriodExtraBudgetPaymentMerchants[_merchant] = _lockTimeSeconds;
        emit SetMerchantSpecificExtraBudgetLockTime(_merchant, _lockTimeSeconds);
    }

    /// @dev GetMerchantSpecificExtraBudgetLockTime
    /// @param _merchant The merchant to check extra budget lock time on
    function getMerchantSpecificExtraBudgetLockTime(address _merchant) public view returns (uint256) {
        if(customLockDownPeriodExtraBudgetPaymentMerchants[_merchant] == 0) {
            return lockDownPeriodExtraBudgetPayment;
        }
        return customLockDownPeriodExtraBudgetPaymentMerchants[_merchant];
    }

    /// @dev PlatformFee
    /// @param _merchant The merchant we want to get the platform fee rate for, either custom defined or default
    function platformFee(address _merchant) public view returns (uint256) {
        if(customPlatformFeeAssigned[_merchant]){
            return customPlatformFee[_merchant];
        } else {
            return defaultPlatformFee;
        }
    }

    /// @dev CreateNewOrder
    /// @param _chargePerInterval Cost of the order every interval
    /// @param _extraBudgetPerInterval Every interval, this amount of budget can be spent by the merchant for extra charges.
    /// @param _intervalDuration The duration of the interval - seconds 9, minutes 8, hourly 7, daily 6, weekly 5, bi-weekly 4, monthly 3, quarter-year 2, bi-yearly 1, yearly 0
    /// @param _erc20 Address of the payment token
    /// @param _merchantDefaultNumberOfOrderIntervals Default number of intervals to approve
    /// @param _trialIntervals Number of intervals that are free
    function createNewOrder(uint256 _chargePerInterval, uint256 _extraBudgetPerInterval, uint256 _intervalDuration, IERC20 _erc20, uint256 _merchantDefaultNumberOfOrderIntervals, uint256 _trialIntervals) public {
        require(_intervalDuration < 10, "Interval duration between 0 and 9");
        // Supports interface
        bool worked = false;
        if (address(_erc20).code.length > 0) {
            try _erc20.totalSupply() returns (uint v){
                if(v > 0) {
                    Order storage order = orders[nextOrder];
                    order.orderId = nextOrder;
                    order.merchant = msg.sender;
                    order.chargePerInterval = _chargePerInterval;
                    order.extraBudgetPerInterval = _extraBudgetPerInterval;
                    order.startTime = _getNow();
                    order.intervalDuration = _intervalDuration;
                    order.erc20 = address(_erc20);
                    order.paused = false;
                    order.trialIntervals = _trialIntervals;
                    require(_merchantDefaultNumberOfOrderIntervals > 0, "Default number of intervals must be above 0");
                    order.merchantDefaultNumberOfOrderIntervals = _merchantDefaultNumberOfOrderIntervals;

                    emit OrderCreated(
                        nextOrder,
                        msg.sender,
                        _chargePerInterval,
                        _extraBudgetPerInterval,
                        order.startTime,
                        _intervalDuration,
                        address(_erc20),
                        _merchantDefaultNumberOfOrderIntervals,
                        _trialIntervals);

                    nextOrder = nextOrder + 1;
                    worked = true;
                } else {
                    worked = false;
                }
            } catch Error(string memory revertReason) {
                worked = false;
            } catch (bytes memory returnData) {
                worked = false;
            }
        }
        require(worked, "ERC20 token not compatible");
    }

    /// @dev GetOrder
    /// @param _orderId The id of the order to get information for
    function getOrder(uint256 _orderId) external view returns
    (uint256 orderId, address merchant, uint256 chargePerInterval, uint256 extraBudgetPerInterval, uint256 startTime, uint256 intervalDuration, address erc20, bool paused, uint256 merchantDefaultNumberOfOrderIntervals, uint256 trialIntervals){
        Order storage order = orders[_orderId];
        return (
        order.orderId,
        order.merchant,
        order.chargePerInterval,
        order.extraBudgetPerInterval,
        order.startTime,
        order.intervalDuration,
        order.erc20,
        order.paused,
        order.merchantDefaultNumberOfOrderIntervals,
        order.trialIntervals
        );
    }


    /// @dev GetCustomerOrder
    /// @param _orderId The id of the order to get information for
    /// @param _customerId Bytes32 customer id for this specific subscription
    function getCustomerOrder(uint256 _orderId, bytes32 _customerId) external view returns
    (bytes32 customerId,
        address customerAddress,
        uint256 extraBudgetPerInterval,
        uint256 extraBudgetUsed,
        uint256 extraBudgetLifetime,
        uint256 approvedPeriodsRemaining, // This number is based on the registration, it is default 36 months of reg
        uint256 trialIntervalsRemaining,
        uint256 firstPaymentMadeTimestamp,
        uint256 numberOfIntervalsPaid,
        bool terminated,
        uint256 amountPaidToDate){
        CustomerOrder storage order = orders[_orderId].customerOrders[_customerId];
        return (
        order.customerId,
        order.customerAddress,
        order.extraBudgetPerInterval,
        order.extraBudgetUsed,
        order.extraBudgetLifetime,
        order.approvedPeriodsRemaining,
        order.trialIntervalsRemaining,
        order.firstPaymentMadeTimestamp,
        order.numberOfIntervalsPaid,
        order.terminated,
        order.amountPaidToDate
        );
    }

    /// @dev GetPaymentHistoryEntry
    /// @param _orderId The id of the order to get information for
    /// @param _customerId Customer bytes32 ID
    /// @param _index A specific entry of payment history
    function getPaymentHistoryEntry(uint256 _orderId, bytes32 _customerId, uint256 _index) external view returns
    (uint256 timestamp, uint256 amount, uint256 feePercentage){
        return (
        customerHistoryTimestamps[_orderId][_customerId][_index],
        customerHistoryAmounts[_orderId][_customerId][_index],
        customerHistoryFeePercentages[_orderId][_customerId][_index]
        );
    }

    /// @dev SetMerchantDefaultNumberOfOrderIntervals
    /// @param _orderId The id of the order
    /// @param _defaultNumberOfOrderIntervals The number of order intervals that the merchant wants to approve
    function setMerchantDefaultNumberOfOrderIntervals(uint256 _orderId, uint256 _defaultNumberOfOrderIntervals) external{
        Order storage order = orders[_orderId];
        require(order.merchant == msg.sender || owner == msg.sender, "Only the merchant or owner can call");
        order.merchantDefaultNumberOfOrderIntervals = _defaultNumberOfOrderIntervals;
        emit OrderSetMerchantDefaultNumberOfOrderIntervals(_orderId, _defaultNumberOfOrderIntervals, msg.sender);
    }

    /// @dev SetOrderPauseState
    /// @param _orderId The id of the order
    /// @param _isPaused True to Pause and False to Unpause
    function setOrderPauseState(uint256 _orderId, bool _isPaused) external{
        Order storage order = orders[_orderId];
        require(order.merchant == msg.sender || owner == msg.sender, "Only the merchant or owner can pause");
        order.paused = _isPaused;
        emit OrderPaused(_orderId, _isPaused, msg.sender);
    }

    /// @dev CustomerAcceptOrder and pay
    /// @param _orderId Order id
    /// @param _customerId Bytes32 Customer ID
    /// @param _extraBudgetPerInterval Extra Budget that the customer is accepting per cycle
    /// @param _approvedPeriods Number of periods or months accepted
    function customerAcceptOrder(uint256 _orderId, bytes32 _customerId, uint256 _extraBudgetPerInterval, uint256 _approvedPeriods) public {
        Order storage order = orders[_orderId];
        require(!order.paused, "Cannot process, this order is paused");

        require(customerIdToAddress[_customerId] == address(0), "Can't reuse customer ids");
        require(order.customerOrders[_customerId].firstPaymentMadeTimestamp == 0, "This customer id is already registered on this order");

        address customerAddress = msg.sender;
        customerIdToAddress[_customerId] = customerAddress;

        // If it is 0 use the default
        if( _approvedPeriods == 0 ){
            _approvedPeriods = order.merchantDefaultNumberOfOrderIntervals;
        }

        uint256 trialPeriodsRemaining = order.trialIntervals;
        if(trialPeriodsRemaining > 0){
            trialPeriodsRemaining = order.trialIntervals - 1;
            customerHistoryTimestamps[_orderId][_customerId].push(_getNow());
            customerHistoryAmounts[_orderId][_customerId].push(uint256(0));
            customerHistoryFeePercentages[_orderId][_customerId].push(uint(0));
        } else{
            // Make payment if there is no free trial
            uint256 calculateFee = (order.chargePerInterval * platformFee(order.merchant)) / (1000);
            require(IERC20(order.erc20).allowance(msg.sender, address(this)) >= order.chargePerInterval, "Insufficient erc20 allowance");
            require(IERC20(order.erc20).balanceOf(msg.sender) >= order.chargePerInterval, "Insufficient balance first month");


            (bool successFee) = IERC20(order.erc20).transferFrom(msg.sender, owner, calculateFee);
            require(successFee, "Fee transfer has failed");

            (bool successMerchant) = IERC20(order.erc20).transferFrom(msg.sender, order.merchant, (order.chargePerInterval - calculateFee));
            require(successMerchant, "Merchant transfer has failed");
            customerHistoryTimestamps[_orderId][_customerId].push(_getNow());
            customerHistoryAmounts[_orderId][_customerId].push( order.chargePerInterval);
            customerHistoryFeePercentages[_orderId][_customerId].push(platformFee(order.merchant));
        }


        // Update customer histories
        order.customerOrders[_customerId] = CustomerOrder({
        customerId: _customerId,
        customerAddress: msg.sender,
        extraBudgetPerInterval: _extraBudgetPerInterval,
        extraBudgetUsed: 0,
        extraBudgetLifetime: 0,
        approvedPeriodsRemaining: _approvedPeriods,
        trialIntervalsRemaining: trialPeriodsRemaining,
        terminated: false,
        amountPaidToDate: order.chargePerInterval,
        firstPaymentMadeTimestamp: _getNow(),
        numberOfIntervalsPaid: 1
        });


        emit OrderAccepted(
            _orderId,
            _customerId,
            msg.sender,
            _getNow(),
            _extraBudgetPerInterval,
            _approvedPeriods,
            trialPeriodsRemaining);
    }

    /// @dev BatchProcessPayment
    /// @param _orderIds Order ids
    /// @param _customerIds The customers bytes32 id array, it must be the same length as the order id array
    /// @param _gasSavingMode False will trigger erc20 tokens to go directly to the merchant. True will use gas saving mode to escrow payments for later withdrawal by the merchant
    /// @param _extraAmounts If there will be extra amounts on a subscription charged, the amount that corresponds to previous arrays
    function batchProcessPayment(uint256[] memory _orderIds, bytes32[] memory _customerIds, bool _gasSavingMode, uint256[] memory _extraAmounts) external {
        require(_orderIds.length == _customerIds.length, "The orders and customers must be equal length");
        require(_orderIds.length == _extraAmounts.length, "The orders and extra amounts must be equal length");

        for(uint256 i=0; i< _orderIds.length; i++){
            bool success;
            string memory revertReason;
            bytes memory revertData;
            (success, revertReason, revertData) = _processPayment(_orderIds[i], _customerIds[i], _gasSavingMode, _extraAmounts[i]);
            if(success)
            {
                emit SuccessfulPay(_orderIds[i], _customerIds[i], customerIdToAddress[_customerIds[i]]);
            } else {
                if(bytes(revertReason).length > 0){
                    emit PaymentFailure(revertReason, _orderIds[i], _customerIds[i], customerIdToAddress[_customerIds[i]]);
                } else {
                    emit PaymentFailureBytes(revertData, _orderIds[i], _customerIds[i], customerIdToAddress[_customerIds[i]]);
                }
            }
        }
    }

    function _processPayment(uint256 _orderId, bytes32 _customerId, bool _gasSavingMode, uint256 extraBudgetAmount) internal returns (bool success, string memory revertCause, bytes memory revertData) {
        Order storage order = orders[_orderId];

        //Need to only allow owner, operator, or merchant to process payment
        require(msg.sender == operator || msg.sender == owner || msg.sender == order.merchant, "Only operator, owner or merchant can process payments");

        require(order.customerOrders[_customerId].firstPaymentMadeTimestamp > 0); // Need to be greater than 0 firstpayment timestamp

        uint256 howManyIntervalsToPay = _howManyIntervalsToPay(order, _customerId);

        if(howManyIntervalsToPay > order.customerOrders[_customerId].approvedPeriodsRemaining){
            howManyIntervalsToPay = order.customerOrders[_customerId].approvedPeriodsRemaining;
        }

        uint256 howManyIntervalsMinusTrialIntervals = 0;
        if(howManyIntervalsToPay > order.customerOrders[_customerId].trialIntervalsRemaining){
            howManyIntervalsMinusTrialIntervals = howManyIntervalsToPay - order.customerOrders[_customerId].trialIntervalsRemaining;
        } else {
            howManyIntervalsMinusTrialIntervals = 0;
        }

        bool terminated = order.customerOrders[_customerId].terminated;

        uint256 howMuchERC20ToSend = howManyIntervalsMinusTrialIntervals * order.chargePerInterval;
        uint256 calculateFee = (howMuchERC20ToSend * platformFee(order.merchant)) / (1000);


        if(!_gasSavingMode){
            try SubscriptionApp(this).payOutMerchantAndFeesInternalMethod(_customerId, howMuchERC20ToSend, calculateFee, order.paused, terminated, order.merchant, order.erc20
            ) {
                order.customerOrders[_customerId].numberOfIntervalsPaid = order.customerOrders[_customerId].numberOfIntervalsPaid + howManyIntervalsToPay;
                order.customerOrders[_customerId].approvedPeriodsRemaining = order.customerOrders[_customerId].approvedPeriodsRemaining - howManyIntervalsToPay;
                if(order.customerOrders[_customerId].trialIntervalsRemaining >= howManyIntervalsToPay){
                    order.customerOrders[_customerId].trialIntervalsRemaining = order.customerOrders[_customerId].trialIntervalsRemaining - howManyIntervalsToPay;
                } else {
                    order.customerOrders[_customerId].trialIntervalsRemaining = 0;
                }
                if(howMuchERC20ToSend > 0) {
                    order.customerOrders[_customerId].amountPaidToDate = order.customerOrders[_customerId].amountPaidToDate + howMuchERC20ToSend;

                    // Update customer histories
                    customerHistoryTimestamps[_orderId][_customerId].push(_getNow());
                    customerHistoryAmounts[_orderId][_customerId].push( order.chargePerInterval);
                    customerHistoryFeePercentages[_orderId][_customerId].push(platformFee(order.merchant));

                    emit OrderPaidOut(
                        _orderId,
                        _customerId,
                        howMuchERC20ToSend,
                        calculateFee,
                        _getNow(),
                        tx.origin
                    );
                }
                // First process extra budget payment
                if(extraBudgetAmount > 0) {
                    (bool success, string memory revertReason) = processExtraBudgetPayment(_orderId, _customerId, extraBudgetAmount, howManyIntervalsToPay);
                    if (!success) {
                        return (false, revertReason, "");
                    }
                }
                return (true, "", "");
            } catch Error(string memory revertReason) {
                return (false, revertReason, "");
            } catch (bytes memory returnData) {
                return (false, "", returnData);
            }
        } else{
            // Gas saving mode holds on to balances accounting for the merchants and owner
            try SubscriptionApp(this).payOutGasSavingInternalMethod(_customerId, howMuchERC20ToSend, order.paused, terminated, order.erc20
            ) {
                order.customerOrders[_customerId].numberOfIntervalsPaid = order.customerOrders[_customerId].numberOfIntervalsPaid + howManyIntervalsToPay;
                order.customerOrders[_customerId].approvedPeriodsRemaining = order.customerOrders[_customerId].approvedPeriodsRemaining - howManyIntervalsToPay;
                if(order.customerOrders[_customerId].trialIntervalsRemaining >= howManyIntervalsToPay){
                    order.customerOrders[_customerId].trialIntervalsRemaining = order.customerOrders[_customerId].trialIntervalsRemaining - howManyIntervalsToPay;
                } else {
                    order.customerOrders[_customerId].trialIntervalsRemaining = 0;
                }
                if(howMuchERC20ToSend > 0) {
                    order.customerOrders[_customerId].amountPaidToDate = order.customerOrders[_customerId].amountPaidToDate + howMuchERC20ToSend;

                    // Update customer histories
                    customerHistoryTimestamps[_orderId][_customerId].push(_getNow());
                    customerHistoryAmounts[_orderId][_customerId].push( order.chargePerInterval);
                    customerHistoryFeePercentages[_orderId][_customerId].push(platformFee(order.merchant));

                    // Update balance -- this is the different part of code
                    pendingOwnerWithdrawalAmountByToken[order.erc20] += calculateFee;
                    pendingMerchantWithdrawalAmountByMerchantAndToken[order.merchant][order.erc20] +=  (howMuchERC20ToSend - calculateFee);

                    emit OrderPaidOutGasSavingMode(
                        _orderId,
                        _customerId,
                        howMuchERC20ToSend,
                        calculateFee,
                        _getNow(),
                        tx.origin
                    );
                }
                // First process extra budget payment
                if(extraBudgetAmount > 0) {
                    (bool success, string memory revertReason) = processExtraBudgetPayment(_orderId, _customerId, extraBudgetAmount, howManyIntervalsToPay);
                    if (!success) {
                        return (false, revertReason, "");
                    }
                }

                return (true, "", "");
            } catch Error(string memory revertReason) {
                return (false, revertReason, "");
            } catch (bytes memory returnData) {
                return (false, "", returnData);
            }
        }
    }

    function payOutMerchantAndFeesInternalMethod(
        bytes32 _customerId,
        uint256 howMuchERC20ToSend,
        uint256 calculateFee,
        bool orderPaused,
        bool terminated,
        address orderMerchant,
        address orderErc20) external {
        require(msg.sender == address(this), "Internal calls only");
        require(!terminated, "This payment has been cancelled");
        require(!orderPaused, "Cannot process, this order is paused");
        require(IERC20(orderErc20).allowance(customerIdToAddress[_customerId], address(this)) >= howMuchERC20ToSend, "Insufficient erc20 allowance");
        require(IERC20(orderErc20).balanceOf(customerIdToAddress[_customerId]) >= howMuchERC20ToSend, "Insufficient balance");

        (bool successFee) = IERC20(orderErc20).transferFrom(customerIdToAddress[_customerId], owner, calculateFee);
        require(successFee, "Fee transfer has failed");

        (bool successMerchant) = IERC20(orderErc20).transferFrom(customerIdToAddress[_customerId], orderMerchant, (howMuchERC20ToSend - calculateFee));
        require(successMerchant, "Merchant transfer has failed");
    }

    function payOutGasSavingInternalMethod(
        bytes32 _customerId,
        uint256 howMuchERC20ToSend,
        bool orderPaused,
        bool terminated,
        address orderErc20) external {
        require(msg.sender == address(this), "Internal calls only");
        require(!terminated, "This payment has been cancelled");
        require(!orderPaused, "Cannot process, this order is paused");
        require(IERC20(orderErc20).allowance(customerIdToAddress[_customerId], address(this)) >= howMuchERC20ToSend, "Insufficient erc20 allowance");
        require(IERC20(orderErc20).balanceOf(customerIdToAddress[_customerId]) >= howMuchERC20ToSend, "Insufficient balance");
        (bool successPayment) = IERC20(orderErc20).transferFrom(customerIdToAddress[_customerId], address(this), howMuchERC20ToSend);
        require(successPayment, 'Token transfer unsuccessful');
    }

    // Check how much erc20 amount is ready for payment
    function howManyIntervalsToPayExternal(uint256 _orderId, bytes32 _customerId) external view returns (uint256 howManyPayableIntervals){
        Order storage order = orders[_orderId];
        return _howManyIntervalsToPay(order, _customerId);
    }

    // Check how much erc20 amount is ready for payment
    function _howManyIntervalsToPay(Order storage order, bytes32 _customerId) internal view returns (uint256){
        // Pick the mode of the invoicing

        uint256 customerCycleStartTime = order.customerOrders[_customerId].firstPaymentMadeTimestamp;
        uint256 numberOfIntervalsPaid = order.customerOrders[_customerId].numberOfIntervalsPaid;

        require(order.intervalDuration < 10, "The cycle mode is not correctly configured");

        uint256 elapsedCycles = 0;

        // Use cycle mode in switch statement
        // We find number of cycles that have elapsed since the first payment was made, and deduce from there with how many have been numberOfIntervalsPaid
        if(order.intervalDuration == 0){
            // Yearly Payment
            elapsedCycles = (elapsedCycles + BokkyPooBahsDateTimeLibrary.diffYears(customerCycleStartTime, _getNow()));
        } else if(order.intervalDuration == 1){
            // 6 Month Payment
            elapsedCycles = (elapsedCycles + (BokkyPooBahsDateTimeLibrary.diffMonths(customerCycleStartTime, _getNow()))/ 6);
        } else if(order.intervalDuration == 2){
            // 3 Month payment
            elapsedCycles = (elapsedCycles + (BokkyPooBahsDateTimeLibrary.diffMonths(customerCycleStartTime, _getNow()))/ 3);
        } else if(order.intervalDuration == 3){
            // Monthly payment
            // Logic for these is that we add the number of passed months
            elapsedCycles = (elapsedCycles + BokkyPooBahsDateTimeLibrary.diffMonths(customerCycleStartTime, _getNow()));
        } else if (order.intervalDuration == 4){
            // Bi-weekly payment
            elapsedCycles = (elapsedCycles + (BokkyPooBahsDateTimeLibrary.diffDays(customerCycleStartTime, _getNow()) / 14));
        } else if (order.intervalDuration == 5){
            // Weekly payment
            elapsedCycles = (elapsedCycles + (BokkyPooBahsDateTimeLibrary.diffDays(customerCycleStartTime, _getNow()) / 7));
        }  else if (order.intervalDuration == 6){
            // Daily payment
            elapsedCycles = (elapsedCycles + BokkyPooBahsDateTimeLibrary.diffDays(customerCycleStartTime, _getNow()));
        } else if (order.intervalDuration == 7){
            // Hourly payment
            elapsedCycles = (elapsedCycles + BokkyPooBahsDateTimeLibrary.diffHours(customerCycleStartTime, _getNow()));
        }  else if (order.intervalDuration == 8){
            // Minute payment
            elapsedCycles = (elapsedCycles + BokkyPooBahsDateTimeLibrary.diffMinutes(customerCycleStartTime, _getNow()));
        } else {
            // Second payment
            elapsedCycles = (elapsedCycles + BokkyPooBahsDateTimeLibrary.diffSeconds(customerCycleStartTime, _getNow()));
        }

        // Return the number of chargeable cycles
        return elapsedCycles - (numberOfIntervalsPaid - 1);
    }

    function processExtraBudgetPayment(
        uint256 _orderId,
        bytes32 _customerId,
        uint256 _extraAmount,
        uint256 _pendingIntervals
    ) internal returns (bool success, string memory revertReason) {
        Order storage order = orders[_orderId];
        CustomerOrder storage customerOrder = order.customerOrders[_customerId];

        uint256 availableBudget = ((uint256(1) + _pendingIntervals) * customerOrder.extraBudgetPerInterval) - customerOrder.extraBudgetUsed;
        if (_extraAmount > availableBudget) {
            return (false, "Exceeds extra budget");
        }

        if ((availableBudget - _extraAmount) > customerOrder.extraBudgetPerInterval) {
            customerOrder.extraBudgetUsed = 0;
        } else {
            // customerOrder.extraBudgetUsed = customerOrder.extraBudgetPerInterval - remainingBudget;
            customerOrder.extraBudgetUsed = customerOrder.extraBudgetPerInterval - (availableBudget - _extraAmount);
        }

        customerOrder.extraBudgetLifetime += _extraAmount;

        PendingExtraBudgetPayment memory newPayment = PendingExtraBudgetPayment({
        customerId: _customerId,
        customerAddress: customerIdToAddress[_customerId],
        timestamp: _getNow(),
        extraAmount: _extraAmount,
        processed: false,
        refunded: false
        });

        pendingExtraBudgetPaymentListByOrderAndCustomer[_orderId].push(newPayment);
        uint256 len = pendingExtraBudgetPaymentListByOrderAndCustomer[_orderId].length;

        bool successExtraPayment = IERC20(order.erc20).transferFrom(customerIdToAddress[_customerId], address(this), _extraAmount);
        if (!successExtraPayment) {
            return (false, "Fee transfer has failed");
        }

        emit ExtraBudgetLogged(_orderId, _customerId, customerIdToAddress[_customerId], _extraAmount, _pendingIntervals, len - 1);

        return (true, "");
    }

    // Function to process pending extra budget payments for a specific order, with an option to limit the range of payments processed
    // Use 0 as endPaymentIndex to process everything after startPaymentIndex
    /// @dev processPendingPayments
    /// @param orderId Order id of the order to process extra pending payments for
    /// @param startPaymentIndex Index to start processing payments at
    /// @param endPaymentIndex Index to end processing payments at, or 0 to process all
    function processPendingPayments(uint256 orderId, uint256 startPaymentIndex, uint256 endPaymentIndex) external {
        Order storage order = orders[orderId];
        require(orderId < nextOrder, "Invalid order ID");
        require(endPaymentIndex == 0 || endPaymentIndex > startPaymentIndex, "End index must be zero or greater than start index");

        uint256 currentTime = _getNow();
        uint256 totalAmountToTransfer = uint256(0);
        uint256 paymentsCount = pendingExtraBudgetPaymentListByOrderAndCustomer[orderId].length;
        uint256 upperBound = (endPaymentIndex == 0 || endPaymentIndex > paymentsCount) ? paymentsCount : endPaymentIndex + 1;

        for (uint256 i = startPaymentIndex; i < upperBound; i++) {
            PendingExtraBudgetPayment storage payment = pendingExtraBudgetPaymentListByOrderAndCustomer[orderId][i];
            if (!payment.processed && ((currentTime - payment.timestamp) >= getMerchantSpecificExtraBudgetLockTime(order.merchant))) {
                totalAmountToTransfer += payment.extraAmount;
                payment.processed = true;
                emit ExtraBudgetPaymentProcessed(orderId, payment.customerId, payment.customerAddress, payment.extraAmount, i);
           }
        }

        if (totalAmountToTransfer > 0) {
            address erc20Token = orders[orderId].erc20;
            address merchant = orders[orderId].merchant;
          //  require(IERC20(erc20Token).transfer(merchant, totalAmountToTransfer), "Transfer failed");

            uint256 calculateFee = (totalAmountToTransfer * platformFee(merchant)) / (1000);

            (bool successFee) = IERC20(erc20Token).transfer(owner, calculateFee);
            require(successFee, "Fee transfer has failed");

            (bool successMerchant) = IERC20(erc20Token).transfer(merchant, (totalAmountToTransfer - calculateFee));
            require(successMerchant, "Merchant transfer has failed");

            emit ExtraBudgetPaidOut(orderId, totalAmountToTransfer, startPaymentIndex, upperBound);
        }
    }

    // Function to refund pending extra budget payments for a specific order, with an option to limit the range of payments processed
    // Use 0 as endPaymentIndex to process everything after startPaymentIndex
    /// @dev refundPendingExtraPayment
    /// @param orderId Order id of the order to refund extra pending payments for
    /// @param startRefundIndex Index to start refund payments at
    /// @param endRefundIndex Index to end refund payments at, or 0 to process all
    function refundPendingExtraPayment(uint256 orderId, uint256 startRefundIndex, uint256 endRefundIndex) external onlyOwner {
        Order storage order = orders[orderId];
        require(msg.sender == order.merchant || msg.sender == owner, "Only the merchant or the contract owner can issue refunds");
        require(orderId < nextOrder, "Invalid order ID");
        require(endRefundIndex == 0 || endRefundIndex > startRefundIndex, "End index must be zero or greater than start index");

        uint256 paymentsCount = pendingExtraBudgetPaymentListByOrderAndCustomer[orderId].length;
        uint256 upperBound = (endRefundIndex == 0 || endRefundIndex > paymentsCount) ? paymentsCount : endRefundIndex + 1;
        address erc20Token = orders[orderId].erc20;

        for (uint256 i = startRefundIndex; i < upperBound; i++) {
            PendingExtraBudgetPayment storage payment = pendingExtraBudgetPaymentListByOrderAndCustomer[orderId][i];
            if (!payment.processed) { // Payment must not yet be processed, so has not been paid or refunded
                payment.processed = true;
                payment.refunded = true;
                require(IERC20(erc20Token).transfer(payment.customerAddress, payment.extraAmount), "Refund failed"); // Extra amount sent BACK to the customer
                emit ExtraBudgetRefunded(orderId, payment.customerId, payment.customerAddress, payment.extraAmount, i);
            }
        }
    }


    /// @dev CustomerRenewOrder
    /// @param _orderId Order Id
    /// @param _customerId Customer id
    /// @param _extraBudgetPerInterval Extra budget allowed per interval
    /// @param _approvedPeriods If renewing , it sets this amount, if extending it adds this amount
    function customerRenewOrder(uint256 _orderId, bytes32 _customerId, uint256 _extraBudgetPerInterval, uint256 _approvedPeriods) external {
        Order storage order = orders[_orderId];

        require(msg.sender == customerIdToAddress[_customerId], "Can only renew your own orders");

        CustomerOrder storage customerOrder = orders[_orderId].customerOrders[_customerId];
        require(customerOrder.firstPaymentMadeTimestamp > 0, "Not valid customer to renew");
        if( _approvedPeriods == 0 ){
            _approvedPeriods = order.merchantDefaultNumberOfOrderIntervals;
        }

        if(customerOrder.terminated){
            // The order was previously cancelled
            // Pays for first month
            require(IERC20(order.erc20).allowance(msg.sender, address(this)) >= order.chargePerInterval, "Insufficient erc20 allowance");
            require(IERC20(order.erc20).balanceOf(msg.sender) >= order.chargePerInterval, "Insufficient balance first month");

            uint256 calculateFee = (order.chargePerInterval * platformFee(order.merchant)) / (1000);

            (bool successFee) = IERC20(order.erc20).transferFrom(msg.sender, owner, calculateFee);
            require(successFee, 'Fee transfer erc20 failed');
            (bool successMerchant) = IERC20(order.erc20).transferFrom(msg.sender, order.merchant, (order.chargePerInterval - calculateFee));
            require(successMerchant, 'Merchant transfer erc20 failed');

            // Update customer histories
            customerHistoryTimestamps[_orderId][_customerId].push(_getNow());
            customerHistoryAmounts[_orderId][_customerId].push( order.chargePerInterval);
            customerHistoryFeePercentages[_orderId][_customerId].push(platformFee(order.merchant));

            customerOrder.approvedPeriodsRemaining = _approvedPeriods;
            customerOrder.numberOfIntervalsPaid = 1;
            customerOrder.firstPaymentMadeTimestamp = _getNow();
            customerOrder.amountPaidToDate = customerOrder.amountPaidToDate + order.chargePerInterval;
            customerOrder.extraBudgetUsed = 0;
            customerOrder.extraBudgetPerInterval = _extraBudgetPerInterval;
            customerOrder.terminated = false;

            emit OrderRenewed(
                _orderId,
                _customerId,
                msg.sender,
                _getNow(),
                _approvedPeriods,
                true);
        } else {
            customerOrder.approvedPeriodsRemaining = customerOrder.approvedPeriodsRemaining + _approvedPeriods;
            customerOrder.extraBudgetUsed = 0;
            customerOrder.extraBudgetPerInterval = _extraBudgetPerInterval;

            emit OrderRenewed(
                _orderId,
                _customerId,
                msg.sender,
                customerOrder.firstPaymentMadeTimestamp,
                _approvedPeriods,
                false);
        }
    }

    /// @dev CustomerCancelPayment
    /// @param _orderId Order id
    /// @param _customerId Bytes32 Customer ID
    function customerCancelOrder(uint256 _orderId, bytes32 _customerId) external {
        Order storage order = orders[_orderId];
        require((customerIdToAddress[_customerId] == msg.sender) || (owner == msg.sender)
            || (order.merchant == msg.sender), "Only the customer, merchant, or owner can cancel an order");
        order.customerOrders[_customerId].terminated = true;
        order.customerOrders[_customerId].approvedPeriodsRemaining = 0;
        order.customerOrders[_customerId].trialIntervalsRemaining = 0;
        order.customerOrders[_customerId].extraBudgetPerInterval = 0;

        emit OrderCancelled(
            _orderId,
            _customerId,
            customerIdToAddress[_customerId]);
    }

    /// @dev Withdraw
    /// @param _erc20Token ERC20 to withdraw for msg sender merchant
    function withdraw(address _erc20Token) public {
        uint256 value = 0;
        if(msg.sender == owner){
            value = pendingOwnerWithdrawalAmountByToken[_erc20Token];

            pendingOwnerWithdrawalAmountByToken[_erc20Token] = 0;

            (bool successWithdraw) = IERC20(_erc20Token).transfer(
                owner,
                value);
            require(successWithdraw, 'ERC20 Withdrawal was unsuccessful');

            emit OwnerWithdrawERC20(_erc20Token, value);
        } else {
            value = pendingMerchantWithdrawalAmountByMerchantAndToken[msg.sender][_erc20Token];

            pendingMerchantWithdrawalAmountByMerchantAndToken[msg.sender][_erc20Token] = 0;

            (bool successWithdraw) = IERC20(_erc20Token).transfer(
                msg.sender,
                value);
            require(successWithdraw, 'ERC20 Withdrawal was unsuccessful');

            emit MerchantWithdrawERC20(_erc20Token, msg.sender, value);
        }
    }

    /// @dev Withdraw
    /// @param _erc20Tokens ERC20 list to withdraw for msg sender merchant
    function withdrawBatch(address[] memory _erc20Tokens) external {
        for(uint256 i=0; i< _erc20Tokens.length; i++){
            withdraw(_erc20Tokens[i]);
        }
    }

    /// @dev Withdraw
    /// @param _user Which merchant to withdraw for, any account can spend gas to withdraw these funds for another
    /// @param _erc20Token ERC20 to withdraw
    function withdrawForUser(address _user, address _erc20Token) public { // For merchant
        uint256 value = pendingMerchantWithdrawalAmountByMerchantAndToken[_user][_erc20Token];
            IERC20(_erc20Token).transfer(
                _user,
                value);
            pendingMerchantWithdrawalAmountByMerchantAndToken[_user][_erc20Token] = 0;
            emit MerchantWithdrawERC20(_erc20Token, _user, value);
    }

    /// @dev OwnerEmergencyRecover
    /// @param _amount Amount of erc20
    /// @param _erc20Token ERC20 to withdraw by Owner in emergencies
    function ownerEmergencyRecover(uint256 _amount, address _erc20Token) public onlyOwner{
            IERC20(_erc20Token).transfer(
                owner,
                    _amount);
    }

    /// @dev AddYearsToTimestamp
    /// @param _timestamp Timestamp
    /// @param _years Years to add to timestamp
    function addYearsToTimestamp(uint _timestamp, uint _years) external view returns (uint newTimestamp){
        return BokkyPooBahsDateTimeLibrary.addYears(_timestamp, _years);
    }

    /// @dev AddMonthsToTimestamp
    /// @param _timestamp Timestamp
    /// @param _months Months to add to timestamp
    function addMonthsToTimestamp(uint _timestamp, uint _months) external view returns (uint newTimestamp){
        return BokkyPooBahsDateTimeLibrary.addMonths(_timestamp, _months);
    }

    function _getNow() internal virtual view returns (uint256) {
        return block.timestamp;
    }
}
