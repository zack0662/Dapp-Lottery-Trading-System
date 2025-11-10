# Dapp-Lottery-Trading-System
Dapp using Solidity and React   
2025秋冬学期 区块链与数字货币作业二

## 如何运行
1. 打开命令行，ganache --deterministic
输出十个固定账户，这里会使用：
(0) 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1 (管理员账户)
(1) 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0 (普通用户账户）

2. cd contracts
npx hardhat compile # 编译合约
npx hardhat run scripts/deploy.ts --network ganache # 部署合约

3. cd ..
cd frontend
npm start # 运行前端

## 功能实现分析

简单描述：项目完成了要求的哪些功能？每个功能具体是如何实现的？

建议分点列出。

## 项目运行截图

放一些项目运行截图。

项目运行成功的关键页面和流程截图。主要包括操作流程以及和区块链交互的截图。

## 参考内容

- 课程的参考Demo见：[DEMOs](https://github.com/LBruyne/blockchain-course-demos)。

- 快速实现 ERC721 和 ERC20：[模版](https://wizard.openzeppelin.com/#erc20)。记得安装相关依赖 ``"@openzeppelin/contracts": "^5.0.0"``。

- 如何实现ETH和ERC20的兑换？ [参考讲解](https://www.wtf.academy/en/docs/solidity-103/DEX/)

如果有其它参考的内容，也请在这里陈列。
