// App.tsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Header from './components/Header';
import ProjectList from './components/ProjectList';
import BettingDetail from './pages/BettingDetail';
import Web3 from 'web3';
import EasyBetABI from './abi/EasyBet.json';
import BetTokenABI from './abi/BetToken.json';
import BetNFTABI from './abi/BetNFT.json';

// 使用最新部署的合约地址
const ADMIN_ADDRESS = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';
const EASYBET_ADDRESS = "0xCfEB869F69431e42cdB54A4F4f105C19C080A601"; // 新部署的 EasyBet 地址
const BETTOKEN_ADDRESS = "0xe78A0F7E598Cc8b0Bb87894B0F60dD2a88d6a8Ab"; // 新部署的 BetToken 地址
const BETNFT_ADDRESS = "0x5b1869D9A4C187F2EAa108f3062412ecf0526b24";   // 新部署的 BetNFT 地址

function App() {
  const [balance, setBalance] = useState(0);
  const [currentAccount, setCurrentAccount] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [betTokenContract, setBetTokenContract] = useState<any>(null);
  const [betNFTContract, setBetNFTContract] = useState<any>(null);
  const [easyBetContract, setEasyBetContract] = useState<any>(null);

  // 初始化 Web3 和合约
  useEffect(() => {
    const initWeb3AndContracts = async () => {
      if (window.ethereum) {
        try {
          console.log('开始初始化 Web3 和合约...');
          
          // 初始化 Web3
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);

          // 获取当前账户
          const accounts = await web3Instance.eth.getAccounts();
          if (accounts.length > 0) {
            setCurrentAccount(accounts[0]);
            console.log('当前账户:', accounts[0]);
          }

          // 检查 ABI 是否加载成功
          if (!EasyBetABI || !EasyBetABI.abi) {
            console.error('EasyBet ABI 未加载');
            return;
          }
          if (!BetTokenABI || !BetTokenABI.abi) {
            console.error('BetToken ABI 未加载');
            return;
          }
          if (!BetNFTABI || !BetNFTABI.abi) {
            console.error('BetNFT ABI 未加载');
            return;
          }

          console.log('使用固定地址初始化合约...');

          // 初始化 EasyBet 合约
          const easyBetContractInstance = new web3Instance.eth.Contract(
            EasyBetABI.abi as any,
            EASYBET_ADDRESS
          );
          setEasyBetContract(easyBetContractInstance);
          console.log('EasyBet 合约初始化完成');
 // 调试：检查合约方法
        console.log('EasyBet 合约方法列表:', Object.keys(easyBetContractInstance.methods));
        console.log('distributeAllPrizes 方法是否存在:', 'distributeAllPrizes' in easyBetContractInstance.methods);
          // 初始化 BetToken 合约
          const betTokenContractInstance = new web3Instance.eth.Contract(
            BetTokenABI.abi as any,
            BETTOKEN_ADDRESS
          );
          setBetTokenContract(betTokenContractInstance);
          console.log('BetToken 合约初始化完成');

          // 初始化 BetNFT 合约
          const betNFTContractInstance = new web3Instance.eth.Contract(
            BetNFTABI.abi as any,
            BETNFT_ADDRESS
          );
          setBetNFTContract(betNFTContractInstance);
          console.log('BetNFT 合约初始化完成');

          // 验证合约关系
          try {
            const betTokenFromEasyBet = await easyBetContractInstance.methods.betToken().call();
            const betNFTFromEasyBet = await easyBetContractInstance.methods.betNFT().call();
            
            console.log('验证合约关系:');
            console.log('EasyBet 中的 BetToken:', betTokenFromEasyBet);
            console.log('配置的 BetToken:', BETTOKEN_ADDRESS);
            console.log('匹配:', String(betTokenFromEasyBet).toLowerCase() === String(BETTOKEN_ADDRESS).toLowerCase());
            
            console.log('EasyBet 中的 BetNFT:', betNFTFromEasyBet);
            console.log('配置的 BetNFT:', BETNFT_ADDRESS);
            console.log('匹配:', String(betNFTFromEasyBet).toLowerCase() === String(BETNFT_ADDRESS).toLowerCase());
            
          } catch (error) {
            console.warn('合约关系验证失败:', error);
          }

          console.log('所有合约初始化成功');

        } catch (error) {
          console.error('初始化 Web3 和合约失败:', error);
        }
      } else {
        console.log('请安装 MetaMask!');
      }
    };

    initWeb3AndContracts();
  }, []);

  // 监听账户变化
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        console.log('账户变化:', accounts);
        if (accounts.length > 0) {
          setCurrentAccount(accounts[0]);
          checkAdminRole(accounts[0]);
        } else {
          setCurrentAccount('');
          setIsAdmin(false);
          setBalance(0);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [betTokenContract, web3]);

  // 检查管理员角色
  const checkAdminRole = async (account: string) => {
    try {
      console.log('检查管理员角色:', account);
      
      // 方式1: 检查是否是预设的管理员地址
      const isPresetAdmin = account.toLowerCase() === ADMIN_ADDRESS.toLowerCase();
      console.log('是否是预设管理员:', isPresetAdmin);
      
      // 方式2: 检查是否是 BetToken 合约的 owner
      let isTokenOwner = false;
      if (betTokenContract && web3) {
        try {
          const tokenOwner = await betTokenContract.methods.owner().call();
          isTokenOwner = tokenOwner.toLowerCase() === account.toLowerCase();
          console.log('Token Owner:', tokenOwner, '是否是当前账户:', isTokenOwner);
        } catch (error) {
          console.error('获取 Token Owner 失败:', error);
        }
      }
      
      const finalIsAdmin = isPresetAdmin || isTokenOwner;
      setIsAdmin(finalIsAdmin);
      console.log('最终管理员状态:', finalIsAdmin);
      
    } catch (error) {
      console.error('检查管理员角色失败:', error);
      setIsAdmin(false);
    }
  };

  // 获取用户余额
  useEffect(() => {
    const fetchUserBalance = async () => {
      if (currentAccount && betTokenContract && web3) {
        try {
          console.log('获取用户余额...');
          const userBalance = await betTokenContract.methods.balanceOf(currentAccount).call();
          const balanceInEther = web3.utils.fromWei(userBalance, 'ether');
          setBalance(parseFloat(balanceInEther));
          console.log('用户余额:', balanceInEther, 'BET');
        } catch (error) {
          console.error('获取用户余额失败:', error);
        }
      }
    };

    fetchUserBalance();
  }, [currentAccount, betTokenContract, web3]);

  // 当合约初始化完成后检查管理员状态
  useEffect(() => {
    if (currentAccount && betTokenContract) {
      checkAdminRole(currentAccount);
    }
  }, [currentAccount, betTokenContract]);

  return (
    <Router>
      <div className="App">
        <Header 
          balance={balance} 
          setBalance={setBalance} 
          currentAccount={currentAccount}
          setCurrentAccount={setCurrentAccount}
          isAdmin={isAdmin}
          betTokenContract={betTokenContract}
          web3={web3}
        />
        <main className="main-content">
          <Routes>
            <Route path="/" element={
              <ProjectList 
                isAdmin={isAdmin}
                currentAccount={currentAccount}
                web3={web3}
                easyBetContract={easyBetContract}
                betTokenContract={betTokenContract}
                betNFTContract={betNFTContract}
              />
            } />
            <Route path="/betting/:projectId" element={
              <BettingDetail 
                balance={balance} 
                setBalance={setBalance} 
                currentAccount={currentAccount}
                isAdmin={isAdmin}
                web3={web3}
                easyBetContract={easyBetContract}
                betTokenContract={betTokenContract}
                betNFTContract={betNFTContract}
              />
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;