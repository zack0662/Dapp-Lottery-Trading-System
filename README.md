# Dapp-Lottery-Trading-System
Dapp using Solidity and React
2025秋冬学期 区块链与数字货币作业二

### 运行方式：
打开命令行，ganache --deterministic  
输出十个固定账户，这里会使用：  
(0) 0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1 (管理员账户)
(1) 0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0 (普通用户账户）

cd contracts  
npx hardhat compile  # 编译合约  
npx hardhat run scripts/deploy.ts --network ganache  # 部署合约  

cd ..  
cd frontend  
npm start # 运行前端  

