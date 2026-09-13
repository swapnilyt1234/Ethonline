// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PassportLendingPool is Ownable {
    IERC20 public collateralToken;
    IERC20 public borrowToken;
    address public oracle;

    mapping(address => uint256) public userScores;
    mapping(address => uint256) public collaterals;
    mapping(address => uint256) public borrows;

    event CollateralDeposited(address indexed user, uint256 amount);
    event LoanBorrowed(address indexed user, uint256 amount);
    event LoanRepaid(address indexed user, uint256 amount);
    event ScoreUpdated(address indexed user, uint256 newScore);

    constructor(address _collateralToken, address _borrowToken, address _oracle) Ownable(msg.sender) {
        collateralToken = IERC20(_collateralToken);
        borrowToken = IERC20(_borrowToken);
        oracle = _oracle;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "Not oracle");
        _;
    }

    function setOracle(address _oracle) external onlyOwner {
        oracle = _oracle;
    }

    // Oracle updates the score from ENS
    function updateScore(address user, uint256 score) external onlyOracle {
        userScores[user] = score;
        emit ScoreUpdated(user, score);
    }

    // Deposit collateral (e.g. MockWETH)
    function depositCollateral(uint256 amount) external {
        require(amount > 0, "Zero amount");
        collaterals[msg.sender] += amount;
        require(collateralToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit CollateralDeposited(msg.sender, amount);
    }

    // Borrow asset (e.g. MockUSDC)
    function borrow(uint256 amount) external {
        require(amount > 0, "Zero amount");
        uint256 score = userScores[msg.sender];
        uint256 collateralValue = collaterals[msg.sender]; // Assume 1:1 price for hackathon
        
        uint256 maxBorrow;
        if (score > 70) {
            maxBorrow = (collateralValue * 150) / 100; // 150% LTV (Under-collateralized)
        } else {
            maxBorrow = (collateralValue * 80) / 100; // 80% LTV (Standard)
        }

        require(borrows[msg.sender] + amount <= maxBorrow, "Insufficient collateral / score too low");

        borrows[msg.sender] += amount;
        require(borrowToken.transfer(msg.sender, amount), "Transfer failed");
        emit LoanBorrowed(msg.sender, amount);
    }

    // Repay loan
    function repay(uint256 amount) external {
        require(amount > 0, "Zero amount");
        require(borrows[msg.sender] >= amount, "Repaying more than borrowed");

        borrows[msg.sender] -= amount;
        require(borrowToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit LoanRepaid(msg.sender, amount);
    }
}
