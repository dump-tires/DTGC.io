// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WhiteDiamondStakingV2
 * @notice NFT-based LP staking where each stake mints a unique NFT with USD value tracking
 */
contract WhiteDiamondStakingV2 is ERC721, Ownable, ReentrancyGuard {
    IERC20 public lpToken;          // URMOM/DTGC LP token
    IERC20 public rewardToken;      // DTGC token
    address public treasury;        // Treasury for fees
    
    uint256 public apr = 70;        // 70% APR
    uint256 public lockPeriod = 90 days;
    uint256 public minStake = 1000 ether;
    
    uint256 public entryFee = 375;      // 3.75% (basis points)
    uint256 public exitFee = 375;       // 3.75%
    uint256 public earlyExitPenalty = 2000;  // 20%
    
    uint256 private _tokenIdCounter;
    uint256 public totalStaked;
    uint256 public totalRewardsPaid;
    
    struct StakePosition {
        uint256 amount;         // LP tokens staked
        uint256 startTime;      // When stake started
        uint256 unlockTime;     // When stake can be withdrawn
        uint256 rewardsPaid;    // Total rewards claimed
        uint256 lpValueUSD;     // USD value of LP at stake time (18 decimals)
        bool active;            // Is this stake active
    }
    
    // tokenId => StakePosition
    mapping(uint256 => StakePosition) public positions;
    
    // owner => tokenIds[]
    mapping(address => uint256[]) private _ownerTokenIds;
    
    event Staked(address indexed user, uint256 tokenId, uint256 amount, uint256 lpValueUSD);
    event Withdrawn(address indexed user, uint256 tokenId, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 tokenId, uint256 rewards);
    event EmergencyWithdraw(address indexed user, uint256 tokenId, uint256 amount);
    
    constructor(
        address _lpToken,
        address _rewardToken,
        address _treasury
    ) ERC721("White Diamond Staking NFT", "WDIAMOND") Ownable(msg.sender) {
        lpToken = IERC20(_lpToken);
        rewardToken = IERC20(_rewardToken);
        treasury = _treasury;
    }
    
    /**
     * @notice Stake LP tokens and mint NFT with USD value tracking
     * @param amount Amount of LP tokens to stake
     * @param lpValueUSD USD value of LP (18 decimals) - passed from frontend
     */
    function stake(uint256 amount, uint256 lpValueUSD) external nonReentrant returns (uint256) {
        require(amount >= minStake, "Below minimum stake");
        require(lpToken.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Calculate entry fee
        uint256 fee = (amount * entryFee) / 10000;
        uint256 stakeAmount = amount - fee;
        
        // Transfer tokens
        lpToken.transferFrom(msg.sender, address(this), stakeAmount);
        if (fee > 0) {
            lpToken.transferFrom(msg.sender, treasury, fee);
        }
        
        // Mint NFT
        uint256 tokenId = ++_tokenIdCounter;
        _safeMint(msg.sender, tokenId);
        
        // Create position
        positions[tokenId] = StakePosition({
            amount: stakeAmount,
            startTime: block.timestamp,
            unlockTime: block.timestamp + lockPeriod,
            rewardsPaid: 0,
            lpValueUSD: lpValueUSD,  // Store USD value on NFT
            active: true
        });
        
        _ownerTokenIds[msg.sender].push(tokenId);
        totalStaked += stakeAmount;
        
        emit Staked(msg.sender, tokenId, stakeAmount, lpValueUSD);
        return tokenId;
    }
    
    /**
     * @notice Withdraw stake after lock period (burns NFT)
     */
    function withdraw(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        StakePosition storage position = positions[tokenId];
        require(position.active, "Position not active");
        require(block.timestamp >= position.unlockTime, "Still locked");
        
        // Calculate and pay rewards
        uint256 rewards = calculateRewards(tokenId);
        if (rewards > 0) {
            require(rewardToken.balanceOf(address(this)) >= rewards, "Insufficient rewards");
            rewardToken.transfer(msg.sender, rewards);
            position.rewardsPaid += rewards;
            totalRewardsPaid += rewards;
        }
        
        // Calculate exit fee
        uint256 amount = position.amount;
        uint256 fee = (amount * exitFee) / 10000;
        uint256 returnAmount = amount - fee;
        
        // Return LP tokens
        lpToken.transfer(msg.sender, returnAmount);
        if (fee > 0) {
            lpToken.transfer(treasury, fee);
        }
        
        // Mark inactive and burn NFT
        position.active = false;
        totalStaked -= amount;
        _burn(tokenId);
        _removeTokenId(msg.sender, tokenId);
        
        emit Withdrawn(msg.sender, tokenId, returnAmount);
    }
    
    /**
     * @notice Claim rewards without withdrawing
     */
    function claimRewards(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        StakePosition storage position = positions[tokenId];
        require(position.active, "Position not active");
        
        uint256 rewards = calculateRewards(tokenId);
        require(rewards > 0, "No rewards");
        require(rewardToken.balanceOf(address(this)) >= rewards, "Insufficient rewards");
        
        rewardToken.transfer(msg.sender, rewards);
        position.rewardsPaid += rewards;
        totalRewardsPaid += rewards;
        
        emit RewardsClaimed(msg.sender, tokenId, rewards);
    }
    
    /**
     * @notice Emergency withdraw with penalty (burns NFT)
     */
    function emergencyWithdraw(uint256 tokenId) external nonReentrant {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        StakePosition storage position = positions[tokenId];
        require(position.active, "Position not active");
        
        uint256 amount = position.amount;
        
        // Calculate rewards with penalty
        uint256 rewards = calculateRewards(tokenId);
        uint256 rewardsAfterPenalty = (rewards * (10000 - earlyExitPenalty)) / 10000;
        
        if (rewardsAfterPenalty > 0 && rewardToken.balanceOf(address(this)) >= rewardsAfterPenalty) {
            rewardToken.transfer(msg.sender, rewardsAfterPenalty);
            position.rewardsPaid += rewardsAfterPenalty;
            totalRewardsPaid += rewardsAfterPenalty;
        }
        
        // Calculate exit fee
        uint256 fee = (amount * exitFee) / 10000;
        uint256 returnAmount = amount - fee;
        
        // Return LP tokens
        lpToken.transfer(msg.sender, returnAmount);
        if (fee > 0) {
            lpToken.transfer(treasury, fee);
        }
        
        // Mark inactive and burn NFT
        position.active = false;
        totalStaked -= amount;
        _burn(tokenId);
        _removeTokenId(msg.sender, tokenId);
        
        emit EmergencyWithdraw(msg.sender, tokenId, returnAmount);
    }
    
    /**
     * @notice Calculate pending rewards for a position
     */
    function calculateRewards(uint256 tokenId) public view returns (uint256) {
        StakePosition memory position = positions[tokenId];
        if (!position.active) return 0;
        
        uint256 timeStaked = block.timestamp - position.startTime;
        uint256 yearlyReward = (position.amount * apr) / 100;
        uint256 totalReward = (yearlyReward * timeStaked) / 365 days;
        
        return totalReward - position.rewardsPaid;
    }
    
    /**
     * @notice Get all active stake tokenIds for an owner
     */
    function getStakesByOwner(address owner) external view returns (uint256[] memory) {
        uint256[] memory ownerTokens = _ownerTokenIds[owner];
        uint256 activeCount = 0;
        
        // Count active stakes
        for (uint256 i = 0; i < ownerTokens.length; i++) {
            if (positions[ownerTokens[i]].active) {
                activeCount++;
            }
        }
        
        // Build active stakes array
        uint256[] memory activeStakes = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < ownerTokens.length; i++) {
            if (positions[ownerTokens[i]].active) {
                activeStakes[index] = ownerTokens[i];
                index++;
            }
        }
        
        return activeStakes;
    }
    
    /**
     * @notice Get full position details including USD value
     */
    function getPosition(uint256 tokenId) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 unlockTime,
        uint256 rewards,
        uint256 lpValueUSD,
        bool active
    ) {
        StakePosition memory position = positions[tokenId];
        uint256 pendingRewards = calculateRewards(tokenId);
        
        return (
            position.amount,
            position.startTime,
            position.unlockTime,
            pendingRewards,
            position.lpValueUSD,
            position.active
        );
    }
    
    /**
     * @notice Get total NFTs minted
     */
    function totalNFTsMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }
    
    // Remove tokenId from owner's list
    function _removeTokenId(address owner, uint256 tokenId) private {
        uint256[] storage tokenIds = _ownerTokenIds[owner];
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (tokenIds[i] == tokenId) {
                tokenIds[i] = tokenIds[tokenIds.length - 1];
                tokenIds.pop();
                break;
            }
        }
    }
    
    // Owner functions
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }
    
    function setAPR(uint256 _apr) external onlyOwner {
        apr = _apr;
    }
    
    function setLockPeriod(uint256 _lockPeriod) external onlyOwner {
        lockPeriod = _lockPeriod;
    }
    
    function setFees(uint256 _entryFee, uint256 _exitFee, uint256 _earlyExitPenalty) external onlyOwner {
        entryFee = _entryFee;
        exitFee = _exitFee;
        earlyExitPenalty = _earlyExitPenalty;
    }
    
    function fundRewards(uint256 amount) external onlyOwner {
        rewardToken.transferFrom(msg.sender, address(this), amount);
    }
    
    function emergencyRecoverERC20(address token, uint256 amount) external onlyOwner {
        require(token != address(lpToken), "Cannot recover staked tokens");
        IERC20(token).transfer(owner(), amount);
    }
}
