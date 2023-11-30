// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

// Uncomment this line to use console.log
import "hardhat/console.sol";

// Import necessary interfaces and libraries
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Vault is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    bool internal locked;
    bool public isPaused;
    mapping(address => bool) public whitelistTokens;
    mapping(address => mapping(address => uint256)) public userInfos;

    event Deposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event Withdrawn(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    event PauseUpdated(bool isPaused);
    event WhitelistAdded(address asset);
    event WhitelistRemoved(address asset);

    constructor() {
        isPaused = false;
    }

    // modifier for prevent reentrancy attack
    modifier noReentrant() {
        require(!locked, "No re-entrancy");
        locked = true;
        _;
        locked = false;
    }

    // pause function by admin
    function pause() external onlyOwner {
        isPaused = true;
        emit PauseUpdated(isPaused);
    }

    // unpause function by admin
    function unpause() external onlyOwner {
        isPaused = false;
        emit PauseUpdated(isPaused);
    }

    // Add whitelist token by admin
    function addWhitelist(address _token) external onlyOwner {
        require(!whitelistTokens[_token], "Assert already added");
        whitelistTokens[_token] = true;
        emit WhitelistAdded(_token);
    }

    // Remove whitelist token by admin
    function removeWhitelist(address _token) external onlyOwner {
        require(whitelistTokens[_token], "Assert already removed");
        whitelistTokens[_token] = false;
        emit WhitelistRemoved(_token);
    }

    // Deposit whitelisted token into vault
    function deposit(address _token, uint256 _amount) external noReentrant {
        require(!isPaused, "Deposit not allowed");
        require(whitelistTokens[_token], "Not whitelisted token");
        require(_amount != 0, "Invalid token amount");

        // Transfer token from user to vault
        IERC20(_token).safeTransferFrom(
            address(msg.sender),
            address(this),
            _amount
        );

        // Update user balance
        userInfos[msg.sender][_token] += _amount;

        // Emit event
        emit Deposited(msg.sender, _token, _amount);
    }

    // Withdraw whitelisted token from vault
    function withdraw(address _token, uint256 _amount) external noReentrant {
        require(!isPaused, "Withdraw not allowed");
        require(_amount != 0, "Invalid token amount");

        // We can skip token whitelisted because can be unlisted after deposit
        // But should allow withdraw in that case

        // Check user deposited amount
        uint256 balance = userInfos[msg.sender][_token];
        require(balance >= _amount, "Insufficient token amount");

        // Transfer token from vault to user
        IERC20(_token).safeTransfer(msg.sender, _amount);

        // Update user balance
        userInfos[msg.sender][_token] = balance - _amount;

        // Emit event
        emit Withdrawn(msg.sender, _token, _amount);
    }
}
