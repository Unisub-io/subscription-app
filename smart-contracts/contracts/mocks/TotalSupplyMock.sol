pragma solidity 0.8.15;

import "../SubscriptionApp.sol";

contract TotalSupplyMock is SubscriptionApp {
    uint256 public nowOverride;

    function setNowOverride(uint256 _now) external {
        nowOverride = _now;
    }

    function _getNow() internal override view returns (uint256) {
        return nowOverride;
     }

    // Comment out to test other coverage branch
    function totalSupply() external returns (uint256){
        return uint256(0);
    }
}
