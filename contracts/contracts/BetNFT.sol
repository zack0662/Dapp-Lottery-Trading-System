// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract BetNFT is ERC721 {
    uint256 private _tokenIdCounter;
    address public marketplace;
    
    // 彩票信息
    struct TicketInfo {
        uint256 projectId; // 项目id，从1开始
        uint256 buyPrice;  // 第一次买入的价格（官方价格）
        uint256 buyTime;  // 买入时间
        address originalOwner;  // 原始拥有者（第一次买入人的地址）可以删除
    }

    // 设置为public，其他合约可以看到映射
    // 彩票的id会有三个映射，1.彩票信息 2.是否挂单 3.挂单价格
    mapping(uint256 => TicketInfo) public ticketInfo; // 存储彩票基本信息
    mapping(uint256 => bool) public isListed; // tokenId的彩票是否在挂单出售
    mapping(uint256 => uint256) public listingPrice;  // tokenId的挂单彩票的价格

    constructor() ERC721("BetTicket", "BTICKET") {
        _tokenIdCounter = 0;  // 为每个彩票生成一个独有的id，不同项目使用同一个NFT，id也会递增
    }

    // 设置市场合约
    function setMarketplace(address _marketplace) public {
        require(marketplace == address(0), "Marketplace already set");
        marketplace = _marketplace;
    }

    // 铸造新彩票
    function mintTicket(address to, uint256 projectId, uint256 price) public returns (uint256) {
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;  // 彩票id从1开始
        
        _mint(to, tokenId);
        ticketInfo[tokenId] = TicketInfo({  // 彩票id和信息进行对应
            projectId: projectId,
            buyPrice: price,
            buyTime: block.timestamp,
            originalOwner: to
        });
        
        return tokenId; // 返回彩票的唯一id
    }

    // 挂单出售
    function listForSale(uint256 tokenId, uint256 price, address caller) public {
        // 卖家需要是彩票当前的拥有者
        require(ownerOf(tokenId) == caller, "Not ticket owner"); 
        // 查看是否已经挂单出售
        require(!isListed[tokenId], "Already listed");
        require(msg.sender == marketplace, "Only marketplace can call this");
        // 批准市场合约可以转移此 NFT，批准之后所有者还是卖家
        // 这里的marketplace设置的就是easybet合约的地址
        approve(marketplace, tokenId);
        
        isListed[tokenId] = true;
        listingPrice[tokenId] = price;   // 挂单价格
    }

    // 取消挂单
    function cancelSale(uint256 tokenId) public {
        // 挂单之后，批准给了市场，但是彩票的拥有者还是当前挂单人员
        require(ownerOf(tokenId) == msg.sender, "Not ticket owner");
        require(isListed[tokenId], "Not listed");
        
        // 撤销批准，批准给了新地址0（空地址），原来的批准失效
        approve(address(0), tokenId);
        
        isListed[tokenId] = false;
        listingPrice[tokenId] = 0;
    }

    // 市场合约执行销售
    function executeSale(uint256 tokenId, address buyer) public {
        require(msg.sender == marketplace, "Only marketplace can execute sale");
        require(isListed[tokenId], "Ticket not listed");
        
        // 挂单彩票还在卖家手里，市场只能进行转移。从卖家地址转移到买家。
        address seller = ownerOf(tokenId);
        // 转移 NFT，卖家->买家，市场帮助转移
        _transfer(seller, buyer, tokenId);
        
        // 清理状态
        isListed[tokenId] = false;
        listingPrice[tokenId] = 0;
    }

    // 获取彩票信息
    function getTicketInfo(uint256 tokenId) public view returns (TicketInfo memory) {
        return ticketInfo[tokenId];
    }
    // 获取当前tokenId计数
    function getCurrentTokenId() public view returns (uint256) {
        return _tokenIdCounter;
    }
}