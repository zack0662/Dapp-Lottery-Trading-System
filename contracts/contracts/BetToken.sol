// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BetToken is ERC20 {
    address public owner;
    // public变量，会自动生成getter方法，其他合约和前端都可以直接使用
    mapping(address => bool) public hasClaimedInitialTokens;
    bool public initialDistributionEnabled = true;
    
    // 积分分配
    uint256 public constant INITIAL_USER_TOKENS = 500 * 10**18; // 用户初始500积分
    uint256 public constant ADMIN_INITIAL_TOKENS = 1000000 * 10**18; // 管理员100万积分
    
    event InitialTokensClaimed(address indexed user, uint256 amount);
    event TokensGranted(address indexed from, address indexed to, uint256 amount);
    event InitialDistributionDisabled();

    constructor() ERC20("BetToken", "BET") {  // 代币名称BetToken, 符号BET
        owner = msg.sender;
        // 给管理员铸造100万积分
        _mint(msg.sender, ADMIN_INITIAL_TOKENS);
    }

    // 用户领取初始积分（只能领取一次）
    function claimInitialTokens() public {
        // 管理员未关闭、第一次领取，才能领取成功
        require(initialDistributionEnabled, "Initial distribution ended");
        require(!hasClaimedInitialTokens[msg.sender], "Already claimed initial tokens");
        
        hasClaimedInitialTokens[msg.sender] = true;
        _mint(msg.sender, INITIAL_USER_TOKENS);
        
        emit InitialTokensClaimed(msg.sender, INITIAL_USER_TOKENS);
    }

    // 管理员可以关闭初始积分领取（未使用）
    function disableInitialDistribution() public onlyOwner {
        initialDistributionEnabled = false;
        emit InitialDistributionDisabled();
    }

    // 管理员赠与积分给其他账户
    function grantTokens(address to, uint256 amount) public onlyOwner {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        _transfer(msg.sender, to, amount);
        emit TokensGranted(msg.sender, to, amount);
    }

    // 仅管理员可调用
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
}