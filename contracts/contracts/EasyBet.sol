// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./BetToken.sol";
import "./BetNFT.sol";

contract EasyBet {
    uint256 private _projectIdCounter; // 项目计数器

    BetToken public betToken; // betToken合约的实例
    BetNFT public betNFT; // betNFT合约的实例
    address public oracle; // 管理员地址

    // 竞猜项目
    struct Project {
        uint256 projectId;
        string name;
        string teamA;
        string teamB;
        string[] options; // 竞猜选项数目，默认为3个，两队或者平局
        uint256 ticketPrice;  // 彩票价格
        uint256 resultTime;  // 开奖时间
        uint256 totalPool; // 总奖池，卖出的彩票总价值
        bool isFinished;  // 是否已经开奖
        uint256 winningOption; // 获胜的一方的索引
        uint256[] ticketIds;  // 该项目下售出的所有彩票tokenId
        bool isActive;  // 是否激活（是否已开始）
        mapping(uint256 => uint256) ticketChoices; // tokenId -> 选择的选项索引
        bool prizesDistributed; // 奖金是否发放
    }

    // 订单薄
    mapping(uint256 => uint256[]) public orderBookTokens; // projectId -> 挂牌的tokenId数组，项目id和对应的挂单彩票id，一对多
    mapping(uint256 => mapping(uint256 => uint256)) public orderBookPrices; // projectId -> tokenId -> 价格

    mapping(uint256 => Project) private projects;  // project-> Project结构体，项目id和对应的项目信息。
    mapping(uint256 => mapping(uint256 => bool)) public winningTickets;  // projectId -> tokenId -> 是否中奖
    mapping(uint256 => mapping(uint256 => bool)) public prizeClaimed;  // projectId -> tokenId -> 是否已领取奖金

    event ProjectCreated(uint256 projectId, string name, string teamA, string teamB, uint256 ticketPrice, uint256 resultTime);
    event ProjectActivated(uint256 projectId);
    event ProjectDeactivated(uint256 projectId);
    event TicketPurchased(uint256 projectId, uint256 tokenId, address buyer, uint256 choice);
    event TicketListed(uint256 projectId, uint256 tokenId, uint256 price);
    event TicketSold(uint256 projectId, uint256 tokenId, address seller, address buyer, uint256 price);
    event TicketCancelled(uint256 projectId, uint256 tokenId, address seller);
    event ResultAnnounced(uint256 projectId, uint256 winningOption);
    event PrizeClaimed(uint256 projectId, uint256 tokenId, uint256 amount);
    event PrizesDistributed(uint256 projectId, uint256 totalWinners, uint256 prizePerTicket);

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can call");
        _;
    }

    modifier projectExists(uint256 projectId) {
        require(_projectExists(projectId), "Project does not exist");
        _;
    }

    modifier projectActive(uint256 projectId) {
        require(projects[projectId].isActive, "Project is not active");
        _;
    }

    constructor(address betTokenAddress, address betNFTAddress) {
        oracle = msg.sender;
        betToken = BetToken(betTokenAddress);
        betNFT = BetNFT(betNFTAddress);
        betNFT.setMarketplace(address(this));
        _projectIdCounter = 0;
    }

    function _projectExists(uint256 projectId) internal view returns (bool) {
        return projects[projectId].projectId != 0;
    }

    // 公证人创建竞猜项目
    function createProject(
        string memory name,
        string memory teamA,
        string memory teamB,
        string[] memory options,
        uint256 ticketPrice,
        uint256 resultTime
    ) public onlyOracle {
        require(options.length >= 2, "At least 2 options required");
        require(ticketPrice > 0, "Ticket price must be positive");
        require(resultTime > block.timestamp, "Result time must be in future");
        require(bytes(teamA).length > 0 && bytes(teamB).length > 0, "Team names cannot be empty");

        _projectIdCounter++;
        uint256 projectId = _projectIdCounter;

        projects[projectId].projectId = projectId;
        projects[projectId].name = name;
        projects[projectId].teamA = teamA;
        projects[projectId].teamB = teamB;
        projects[projectId].options = options;
        projects[projectId].ticketPrice = ticketPrice;
        projects[projectId].resultTime = resultTime;
        projects[projectId].totalPool = 0;
        projects[projectId].isFinished = false;
        projects[projectId].winningOption = 0;
        projects[projectId].isActive = false;

        emit ProjectCreated(projectId, name, teamA, teamB, ticketPrice, resultTime);
    }

    // 激活项目
    function activateProject(uint256 projectId) public onlyOracle projectExists(projectId) {
        Project storage project = projects[projectId];
        require(!project.isActive, "Project already active");
        require(!project.isFinished, "Cannot activate finished project");
        require(block.timestamp < project.resultTime, "Cannot activate expired project");
        
        project.isActive = true;
        // 发送事件，前端监听到赛事变成activated状态了，直接更新在显示栏里
        emit ProjectActivated(projectId);
    }

    // 停用项目
    function deactivateProject(uint256 projectId) public onlyOracle projectExists(projectId) {
        Project storage project = projects[projectId];
        require(project.isActive, "Project already inactive");
        
        project.isActive = false;
        emit ProjectDeactivated(projectId);
    }

    // 玩家购买彩票
    function purchaseTicket(uint256 projectId, uint256 choice) public projectExists(projectId) projectActive(projectId) {
        Project storage project = projects[projectId];
        require(block.timestamp < project.resultTime, "Betting period ended");
        require(!project.isFinished, "Project finished");
        require(choice < project.options.length, "Invalid choice");

        // 转移积分
        require(betToken.transferFrom(msg.sender, address(this), project.ticketPrice), "Token transfer failed");
        project.totalPool += project.ticketPrice;

        // 铸造NFT彩票
        uint256 tokenId = betNFT.mintTicket(msg.sender, projectId, project.ticketPrice);
        project.ticketIds.push(tokenId);
        
        // 记录用户的选择
        project.ticketChoices[tokenId] = choice;

        emit TicketPurchased(projectId, tokenId, msg.sender, choice);
    }
    // 获取某个项目下某张彩票的选择
    function getTicketChoice(uint256 projectId, uint256 tokenId) public view projectExists(projectId) returns (uint256) {
        return projects[projectId].ticketChoices[tokenId];
    }
    // 挂单出售彩票 
    function listTicket(uint256 tokenId, uint256 price) public {
        require(betNFT.ownerOf(tokenId) == msg.sender, "Not ticket owner");
        // 从彩票中获取项目id
        uint256 projectId = betNFT.getTicketInfo(tokenId).projectId;
        
        // 检查此项目
        require(projects[projectId].projectId != 0, "Project does not exist");
        require(projects[projectId].isActive, "Project not active");
        require(!projects[projectId].isFinished, "Project finished");

        betNFT.listForSale(tokenId, price, msg.sender);  // 传递真正的调用者（用户）
        
        // 添加到订单薄
        orderBookTokens[projectId].push(tokenId);
        orderBookPrices[projectId][tokenId] = price;

        emit TicketListed(projectId, tokenId, price);
    }

    // 从订单薄购买彩票
    function buyFromOrderBook(uint256 projectId, uint256 tokenId) public projectExists(projectId) {
        require(betNFT.isListed(tokenId), "Ticket not listed");
        require(orderBookPrices[projectId][tokenId] > 0, "Ticket not in order book");
        
        uint256 price = orderBookPrices[projectId][tokenId];
        // 卖家是彩票的拥有者，不是市场合约地址。
        address seller = betNFT.ownerOf(tokenId);
        
        // 转移积分，转移给彩票的拥有者
        require(betToken.transferFrom(msg.sender, seller, price), "Token transfer failed");
        
        // 通过 BetNFT 的安全转移
        betNFT.executeSale(tokenId, msg.sender);
        
        _removeFromOrderBook(projectId, tokenId);

        emit TicketSold(projectId, tokenId, seller, msg.sender, price);
    }

    // 取消挂牌
    function cancelListing(uint256 tokenId) public {
        require(betNFT.ownerOf(tokenId) == msg.sender, "Not ticket owner");
        uint256 projectId = betNFT.getTicketInfo(tokenId).projectId;
        
        betNFT.cancelSale(tokenId);
        _removeFromOrderBook(projectId, tokenId);
        emit TicketCancelled(projectId, tokenId, msg.sender);
    }

    // 在 announceResult 函数中修改奖金分配逻辑
    function announceResult(uint256 projectId, uint256 winningOption) public onlyOracle projectExists(projectId) {
        Project storage project = projects[projectId];
        require(block.timestamp >= project.resultTime, "Result time not reached");
        require(!project.isFinished, "Result already announced");
        require(winningOption < project.options.length, "Invalid winning option");

        project.winningOption = winningOption;
        project.isFinished = true;
        project.isActive = false;
        project.prizesDistributed = false; 
        // 标记中奖彩票
        for (uint256 i = 0; i < project.ticketIds.length; i++) {
            uint256 tokenId = project.ticketIds[i];
            if (project.ticketChoices[tokenId] == winningOption) {
                winningTickets[projectId][tokenId] = true;
            }
        }
        
        emit ResultAnnounced(projectId, winningOption);
    }

    // 修改领取奖金函数
    function claimPrize(uint256 projectId, uint256 tokenId) public projectExists(projectId) {
        Project storage project = projects[projectId];
        require(project.isFinished, "Project not finished");
        require(betNFT.ownerOf(tokenId) == msg.sender, "Not ticket owner");
        require(winningTickets[projectId][tokenId], "Not winning ticket");
        require(!prizeClaimed[projectId][tokenId], "Prize already claimed");

        // 使用现有的内部函数获取中奖彩票数量
        uint256 winningTicketCount = _getWinningTicketCount(projectId);
        require(winningTicketCount > 0, "No winning tickets");
        
        // 按彩票数量平分奖金（每张中奖彩票获得相同的奖金）
        uint256 prizePerTicket = project.totalPool / winningTicketCount;
        prizeClaimed[projectId][tokenId] = true;
        
        require(betToken.transfer(msg.sender, prizePerTicket), "Prize transfer failed");

        emit PrizeClaimed(projectId, tokenId, prizePerTicket);
    }

    // 内部函数：获取中奖彩票数量
    function _getWinningTicketCount(uint256 projectId) internal view returns (uint256) {
        Project storage project = projects[projectId];
        uint256 count = 0;
        
        for (uint256 i = 0; i < project.ticketIds.length; i++) {
            if (winningTickets[projectId][project.ticketIds[i]]) {
                count++;
            }
        }
        
        return count;
    }

    // 管理员统一分发奖金给所有中奖用户
    function distributeAllPrizes(uint256 projectId) public onlyOracle projectExists(projectId) {
        Project storage project = projects[projectId];
        require(project.isFinished, "Project not finished");
        require(!project.prizesDistributed, "Prizes already distributed");
        
        uint256 winningTicketCount = _getWinningTicketCount(projectId);
        require(winningTicketCount > 0, "No winning tickets");
        
        uint256 prizePerTicket = project.totalPool / winningTicketCount;
        uint256 distributedCount = 0;
        
        // 遍历所有彩票，给中奖且未领取的用户分发奖金
        for (uint256 i = 0; i < project.ticketIds.length; i++) {
            uint256 tokenId = project.ticketIds[i];
            
            // 如果是中奖彩票且未领取
            if (winningTickets[projectId][tokenId] && !prizeClaimed[projectId][tokenId]) {
                address ticketOwner = betNFT.ownerOf(tokenId);
                prizeClaimed[projectId][tokenId] = true;
                
                require(betToken.transfer(ticketOwner, prizePerTicket), "Prize transfer failed");
                distributedCount++;
                
                emit PrizeClaimed(projectId, tokenId, prizePerTicket);
            }
        }
        
        // 标记奖金已分发
        project.prizesDistributed = true;
        
        emit PrizesDistributed(projectId, distributedCount, prizePerTicket);
    }

    // 内部函数：从订单薄移除
    function _removeFromOrderBook(uint256 projectId, uint256 tokenId) internal {
        uint256[] storage tokens = orderBookTokens[projectId];
        
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenId) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                break;
            }
        }
        
        delete orderBookPrices[projectId][tokenId];
    }

    // 获取项目订单薄，此项目下的所有挂单彩票
    function getOrderBook(uint256 projectId) public view projectExists(projectId) returns (uint256[] memory, uint256[] memory) {
        uint256[] storage tokenIds = orderBookTokens[projectId];
        uint256 length = tokenIds.length;
        uint256[] memory prices = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = tokenIds[i];
            prices[i] = orderBookPrices[projectId][tokenId];
        }
        
        return (tokenIds, prices);
    }

    // 获取项目信息
    function getProjectInfo(uint256 projectId) public view projectExists(projectId) returns (
        string memory name,
        string memory teamA,
        string memory teamB,
        string[] memory options,
        uint256 ticketPrice,
        uint256 resultTime,
        uint256 totalPool,
        bool isFinished,
        bool isActive,
        uint256 winningOption,
        uint256 ticketCount,
        bool prizesDistributed
    ) {
        Project storage project = projects[projectId];
        return (
            project.name,
            project.teamA,
            project.teamB,
            project.options,
            project.ticketPrice,
            project.resultTime,
            project.totalPool,
            project.isFinished,
            project.isActive,
            project.winningOption,
            project.ticketIds.length,
            project.prizesDistributed
        );
    }

    // 获取彩票的详细信息
    function getTicketDetails(uint256 tokenId) public view returns (
        uint256 projectId,
        string memory projectName,
        string memory teamA,
        string memory teamB,
        uint256 buyPrice,
        uint256 buyTime,
        bool isListed,
        uint256 listingPrice,
        bool isWinner,
        uint256 userChoice,
        uint256 winningOption,
        string memory userChoiceText,
        string memory winningText
    ) {
        BetNFT.TicketInfo memory ticket = betNFT.getTicketInfo(tokenId);
        Project storage project = projects[ticket.projectId];
        
        userChoice = project.ticketChoices[tokenId];
        winningOption = project.winningOption;
        userChoiceText = project.options[userChoice];
        winningText = project.options[winningOption];
        
        return (
            ticket.projectId,
            project.name,
            project.teamA,
            project.teamB,
            ticket.buyPrice,
            ticket.buyTime,
            betNFT.isListed(tokenId),
            betNFT.listingPrice(tokenId),
            winningTickets[ticket.projectId][tokenId],
            userChoice,
            winningOption,
            userChoiceText,
            winningText
        );
    }

    // 获取活跃项目
    function getActiveProjects() public view returns (uint256[] memory) {
        uint256 totalProjects = _projectIdCounter;
        // 如果没有项目，返回空数组
        if (totalProjects == 0) {
            return new uint256[](0);
        }
        uint256 activeCount = 0;
        
        for (uint256 i = 1; i <= totalProjects; i++) {
            if (projects[i].isActive && !projects[i].isFinished) {
                activeCount++;
            }
        }
        
        uint256[] memory activeProjects = new uint256[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= totalProjects; i++) {
            if (projects[i].isActive && !projects[i].isFinished) {
                activeProjects[index] = i;
                index++;
            }
        }
        
        return activeProjects;
    }
    // 修复的 getAllProjects 函数
    function getAllProjects() public view returns (uint256[] memory) {
        uint256 totalProjects = _projectIdCounter;
        uint256[] memory allProjects = new uint256[](totalProjects);
        
        for (uint256 i = 0; i < totalProjects; i++) {
            allProjects[i] = i + 1; // 项目ID从1开始
        }
        
        return allProjects;
    }

    // 获取用户彩票
    function getUserTickets(address user) public view returns (uint256[] memory) {
        uint256 totalProjects = _projectIdCounter;
        uint256 ticketCount = 0;
        
        for (uint256 i = 1; i <= totalProjects; i++) {
            for (uint256 j = 0; j < projects[i].ticketIds.length; j++) {
                if (betNFT.ownerOf(projects[i].ticketIds[j]) == user) {
                    ticketCount++;
                }
            }
        }
        
        uint256[] memory userTickets = new uint256[](ticketCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= totalProjects; i++) {
            for (uint256 j = 0; j < projects[i].ticketIds.length; j++) {
                uint256 tokenId = projects[i].ticketIds[j];
                if (betNFT.ownerOf(tokenId) == user) {
                    userTickets[index] = tokenId;
                    index++;
                }
            }
        }
        
        return userTickets;
    }

    // 获取用户积分余额
    function getUserBalance(address user) public view returns (uint256) {
        return betToken.balanceOf(user);
    }

    // 获取项目总数
    function getProjectCount() public view returns (uint256) {
        return _projectIdCounter;
    }
}