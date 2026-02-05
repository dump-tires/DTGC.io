// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MetalsFlywheel
 * @author DTGC.io - Q7 Quant Team
 * @notice 5% Win Reallocation Protocol - Captures 5% of profitable trades
 *         and bridges them to PulseChain for PLS accumulation
 * @dev Deployed on Arbitrum One, interfaces with ZapperX bridge
 */
contract MetalsFlywheel is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    uint256 public constant FLYWHEEL_PERCENTAGE = 500; // 5% = 500 basis points
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_PROFIT_THRESHOLD = 1e6; // $1 USDC minimum

    // ============ State Variables ============
    IERC20 public immutable usdc;
    address public zapperXBridge;
    address public growthEngineWallet;
    address public tradingBot;

    // Stats tracking
    uint256 public totalProfitProcessed;
    uint256 public totalFlywheelAllocated;
    uint256 public totalTradesProcessed;
    uint256 public totalWinningTrades;

    // Per-user tracking
    mapping(address => uint256) public userProfitContributed;
    mapping(address => uint256) public userTradesCount;

    // ============ Events ============
    event ProfitProcessed(
        address indexed trader,
        uint256 grossProfit,
        uint256 flywheelAmount,
        uint256 timestamp
    );

    event FlywheelBridged(
        uint256 amount,
        address indexed destinationWallet,
        uint256 timestamp
    );

    event ZapperXBridgeUpdated(address indexed oldBridge, address indexed newBridge);
    event GrowthEngineWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event TradingBotUpdated(address indexed oldBot, address indexed newBot);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);

    // ============ Errors ============
    error InvalidAddress();
    error InsufficientProfit();
    error UnauthorizedCaller();
    error BridgeFailed();

    // ============ Modifiers ============
    modifier onlyTradingBot() {
        if (msg.sender != tradingBot && msg.sender != owner()) revert UnauthorizedCaller();
        _;
    }

    // ============ Constructor ============
    /**
     * @notice Initialize the Flywheel contract
     * @param _usdc USDC token address on Arbitrum
     * @param _zapperXBridge ZapperX bridge contract address
     * @param _growthEngineWallet PulseChain growth wallet (receives PLS)
     * @param _tradingBot Authorized trading bot address
     */
    constructor(
        address _usdc,
        address _zapperXBridge,
        address _growthEngineWallet,
        address _tradingBot
    ) {
        if (_usdc == address(0)) revert InvalidAddress();
        if (_zapperXBridge == address(0)) revert InvalidAddress();
        if (_growthEngineWallet == address(0)) revert InvalidAddress();
        if (_tradingBot == address(0)) revert InvalidAddress();

        usdc = IERC20(_usdc);
        zapperXBridge = _zapperXBridge;
        growthEngineWallet = _growthEngineWallet;
        tradingBot = _tradingBot;
    }

    // ============ Core Functions ============

    /**
     * @notice Process a winning trade and allocate 5% to the flywheel
     * @dev Called by trading bot after a profitable trade closes
     * @param trader Address of the trader who made the profit
     * @param grossProfit Total profit amount in USDC (6 decimals)
     */
    function processWinningTrade(
        address trader,
        uint256 grossProfit
    ) external onlyTradingBot nonReentrant whenNotPaused {
        if (grossProfit < MIN_PROFIT_THRESHOLD) revert InsufficientProfit();

        // Calculate 5% flywheel allocation
        uint256 flywheelAmount = (grossProfit * FLYWHEEL_PERCENTAGE) / BASIS_POINTS;

        // Transfer USDC from trading bot to this contract
        usdc.safeTransferFrom(msg.sender, address(this), flywheelAmount);

        // Update stats
        totalProfitProcessed += grossProfit;
        totalFlywheelAllocated += flywheelAmount;
        totalTradesProcessed++;
        totalWinningTrades++;
        userProfitContributed[trader] += flywheelAmount;
        userTradesCount[trader]++;

        emit ProfitProcessed(trader, grossProfit, flywheelAmount, block.timestamp);
    }

    /**
     * @notice Bridge accumulated USDC to PulseChain via ZapperX
     * @dev Converts USDC to PLS and sends to growth engine wallet
     */
    function bridgeToPulseChain() external onlyOwner nonReentrant whenNotPaused {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert InsufficientProfit();

        // Approve ZapperX bridge
        usdc.safeApprove(zapperXBridge, balance);

        // Call ZapperX bridge (interface varies by bridge implementation)
        // This is a simplified interface - actual implementation depends on ZapperX
        (bool success,) = zapperXBridge.call(
            abi.encodeWithSignature(
                "bridgeAndSwap(address,uint256,address,uint256)",
                address(usdc),      // Source token
                balance,            // Amount
                growthEngineWallet, // Destination on PulseChain
                369                 // PulseChain chain ID
            )
        );

        if (!success) revert BridgeFailed();

        emit FlywheelBridged(balance, growthEngineWallet, block.timestamp);
    }

    /**
     * @notice Withdraw accumulated USDC for manual bridging via ZapperX
     * @dev Use this when ZapperX requires EOA interaction
     * @param to Address to receive USDC (typically owner's EOA for manual bridging)
     */
    function withdrawForManualBridge(address to) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAddress();
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert InsufficientProfit();

        usdc.safeTransfer(to, balance);

        emit FlywheelBridged(balance, to, block.timestamp);
    }

    /**
     * @notice Batch process multiple winning trades
     * @param traders Array of trader addresses
     * @param profits Array of profit amounts
     */
    function batchProcessWinningTrades(
        address[] calldata traders,
        uint256[] calldata profits
    ) external onlyTradingBot nonReentrant whenNotPaused {
        require(traders.length == profits.length, "Array length mismatch");

        uint256 totalFlywheelAmount;

        for (uint256 i = 0; i < traders.length; i++) {
            if (profits[i] >= MIN_PROFIT_THRESHOLD) {
                uint256 flywheelAmount = (profits[i] * FLYWHEEL_PERCENTAGE) / BASIS_POINTS;
                totalFlywheelAmount += flywheelAmount;

                totalProfitProcessed += profits[i];
                totalFlywheelAllocated += flywheelAmount;
                totalTradesProcessed++;
                totalWinningTrades++;
                userProfitContributed[traders[i]] += flywheelAmount;
                userTradesCount[traders[i]]++;

                emit ProfitProcessed(traders[i], profits[i], flywheelAmount, block.timestamp);
            }
        }

        if (totalFlywheelAmount > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), totalFlywheelAmount);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get accumulated USDC ready to bridge
     */
    function getPendingBridgeAmount() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Get flywheel statistics
     */
    function getFlywheelStats() external view returns (
        uint256 _totalProfitProcessed,
        uint256 _totalFlywheelAllocated,
        uint256 _totalTradesProcessed,
        uint256 _totalWinningTrades,
        uint256 _pendingBridge
    ) {
        return (
            totalProfitProcessed,
            totalFlywheelAllocated,
            totalTradesProcessed,
            totalWinningTrades,
            usdc.balanceOf(address(this))
        );
    }

    /**
     * @notice Get user contribution stats
     */
    function getUserStats(address user) external view returns (
        uint256 contributed,
        uint256 trades
    ) {
        return (userProfitContributed[user], userTradesCount[user]);
    }

    /**
     * @notice Calculate flywheel amount for a given profit
     */
    function calculateFlywheelAmount(uint256 profit) external pure returns (uint256) {
        return (profit * FLYWHEEL_PERCENTAGE) / BASIS_POINTS;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update ZapperX bridge address
     */
    function setZapperXBridge(address _newBridge) external onlyOwner {
        if (_newBridge == address(0)) revert InvalidAddress();
        emit ZapperXBridgeUpdated(zapperXBridge, _newBridge);
        zapperXBridge = _newBridge;
    }

    /**
     * @notice Update growth engine wallet (PulseChain destination)
     */
    function setGrowthEngineWallet(address _newWallet) external onlyOwner {
        if (_newWallet == address(0)) revert InvalidAddress();
        emit GrowthEngineWalletUpdated(growthEngineWallet, _newWallet);
        growthEngineWallet = _newWallet;
    }

    /**
     * @notice Update authorized trading bot
     */
    function setTradingBot(address _newBot) external onlyOwner {
        if (_newBot == address(0)) revert InvalidAddress();
        emit TradingBotUpdated(tradingBot, _newBot);
        tradingBot = _newBot;
    }

    /**
     * @notice Pause contract in emergency
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw tokens (admin only)
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdraw(token, amount, to);
    }
}
