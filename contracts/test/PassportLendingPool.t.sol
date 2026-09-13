// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PassportLendingPool.sol";

contract PassportLendingPoolTest is Test {
    PassportLendingPool public pool;
    address public borrower = address(1);

    function setUp() public {
        pool = new PassportLendingPool();
        // Fund the pool with some liquidity
        pool.deposit{value: 10 ether}();
        // Fund borrower
        vm.deal(borrower, 1 ether);
    }

    function test_Deposit() public {
        assertEq(address(pool).balance, 10 ether);
    }

    function test_RequestLoan() public {
        vm.prank(borrower);
        pool.requestLoan(1 ether);

        (uint256 amount, uint256 repayAmount, , bool repaid, bool defaulted) = pool.loans(borrower, 1);
        assertEq(amount, 1 ether);
        assertEq(repayAmount, 1.1 ether); // 10% interest for tier 1
        assertEq(repaid, false);
        assertEq(defaulted, false);
        assertEq(borrower.balance, 2 ether); // 1 initial + 1 loaned
    }

    function test_RepayLoan() public {
        vm.prank(borrower);
        pool.requestLoan(1 ether);

        vm.deal(borrower, 1.1 ether); // give enough to repay
        vm.prank(borrower);
        pool.repayLoan{value: 1.1 ether}(1);

        (, , , bool repaid, ) = pool.loans(borrower, 1);
        assertTrue(repaid);
    }

    function test_DefaultLoan() public {
        vm.prank(borrower);
        pool.requestLoan(1 ether);

        vm.warp(block.timestamp + 8 days);

        pool.markDefault(borrower, 1);

        (, , , bool repaid, bool defaulted) = pool.loans(borrower, 1);
        assertFalse(repaid);
        assertTrue(defaulted);
    }
}
