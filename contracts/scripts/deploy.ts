import { ethers } from "hardhat";

async function main() {
  console.log("开始部署 EasyBet 合约...");
  
  const BetToken = await ethers.getContractFactory("BetToken");
  const BetNFT = await ethers.getContractFactory("BetNFT");
  const EasyBet = await ethers.getContractFactory("EasyBet");
  
  console.log("获取合约工厂成功");
  
  // 部署 BetToken
  console.log("部署 BetToken...");
  const betToken = await BetToken.deploy();
  await betToken.deployed();
  console.log(`✅ BetToken 部署到: ${betToken.address}`);
  
  // 部署 BetNFT
  console.log("部署 BetNFT...");
  const betNFT = await BetNFT.deploy();
  await betNFT.deployed();
  console.log(`✅ BetNFT 部署到: ${betNFT.address}`);
  
  // 部署 EasyBet
  console.log("部署 EasyBet...");
  const easyBet = await EasyBet.deploy(betToken.address, betNFT.address);
  await easyBet.deployed();
  console.log(`✅ EasyBet 部署到: ${easyBet.address}`);
  
  // 检查是否已经设置过市场地址
  console.log("检查 BetNFT 市场地址...");
  try {
    const currentMarketplace = await betNFT.marketplace();
    console.log(`当前市场地址: ${currentMarketplace}`);
    
    if (currentMarketplace === ethers.constants.AddressZero) {
      // 如果还没有设置，进行设置
      console.log("设置 BetNFT 的市场地址...");
      const setTx = await betNFT.setMarketplace(easyBet.address);
      await setTx.wait();
      console.log("✅ BetNFT 市场地址设置完成");
    } else {
      console.log("✅ BetNFT 市场地址已经设置，跳过");
    }
  } catch (error) {
    console.log("无法获取当前市场地址，尝试设置...");
    try {
      const setTx = await betNFT.setMarketplace(easyBet.address);
      await setTx.wait();
      console.log("✅ BetNFT 市场地址设置完成");
    } catch (setError) {
      console.log("❌ 设置市场地址失败，可能已经设置过");
    }
  }
  
  console.log("\n=== 部署完成 ===");
  console.log("BetToken 地址:", betToken.address);
  console.log("BetNFT 地址:", betNFT.address);
  console.log("EasyBet 地址:", easyBet.address);
  
  // 验证合约关系
  console.log("\n=== 验证合约关系 ===");
  const easyBetBetToken = await easyBet.betToken();
  const easyBetBetNFT = await easyBet.betNFT();
  console.log("EasyBet 中的 BetToken 地址:", easyBetBetToken);
  console.log("EasyBet 中的 BetNFT 地址:", easyBetBetNFT);
  console.log("地址匹配:", 
    easyBetBetToken === betToken.address && 
    easyBetBetNFT === betNFT.address
  );
}

main().catch((error) => {
  console.error("部署失败:", error);
  process.exitCode = 1;
});