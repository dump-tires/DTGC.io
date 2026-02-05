// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IZapperXBridge
 * @notice Interface for ZapperX cross-chain bridge
 * @dev Bridges assets from Arbitrum to PulseChain with atomic swap
 */
interface IZapperXBridge {
    /**
     * @notice Bridge tokens to another chain with optional swap
     * @param sourceToken Token to bridge from
     * @param amount Amount to bridge
     * @param destinationWallet Recipient on destination chain
     * @param destinationChainId Target chain ID (369 for PulseChain)
     * @return bridgeId Unique identifier for this bridge transaction
     */
    function bridgeAndSwap(
        address sourceToken,
        uint256 amount,
        address destinationWallet,
        uint256 destinationChainId
    ) external returns (bytes32 bridgeId);

    /**
     * @notice Get bridge status
     * @param bridgeId Bridge transaction identifier
     * @return status 0=pending, 1=completed, 2=failed
     */
    function getBridgeStatus(bytes32 bridgeId) external view returns (uint8 status);

    /**
     * @notice Get estimated output amount after bridge + swap
     * @param sourceToken Source token address
     * @param amount Input amount
     * @param destinationChainId Target chain
     * @return estimatedOutput Expected output in destination token
     */
    function getEstimatedOutput(
        address sourceToken,
        uint256 amount,
        uint256 destinationChainId
    ) external view returns (uint256 estimatedOutput);

    /**
     * @notice Get bridge fee
     * @param amount Amount to bridge
     * @return fee Fee in source token
     */
    function getBridgeFee(uint256 amount) external view returns (uint256 fee);

    // Events
    event BridgeInitiated(
        bytes32 indexed bridgeId,
        address indexed sender,
        address sourceToken,
        uint256 amount,
        address destinationWallet,
        uint256 destinationChainId
    );

    event BridgeCompleted(
        bytes32 indexed bridgeId,
        uint256 outputAmount
    );

    event BridgeFailed(
        bytes32 indexed bridgeId,
        string reason
    );
}
