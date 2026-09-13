// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockTokens.sol";
import "../src/PassportLendingPool.sol";

contract DeployPhase4 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        MockWETH weth = new MockWETH();
        MockUSDC usdc = new MockUSDC();

        // Pass oracle address (the deployer itself will be the oracle for this hackathon)
        address oracle = vm.addr(deployerPrivateKey);
        PassportLendingPool pool = new PassportLendingPool(address(weth), address(usdc), oracle);

        // Transfer some MockUSDC to the pool so it has liquidity to lend out
        usdc.transfer(address(pool), 500000 * 10**usdc.decimals());

        vm.stopBroadcast();

        console.log("MockWETH deployed at:", address(weth));
        console.log("MockUSDC deployed at:", address(usdc));
        console.log("PassportLendingPool deployed at:", address(pool));
    }
}
