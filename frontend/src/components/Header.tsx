// components/Header.tsx
import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import Portal from './Portal';

// 声明全局的 web3 类型
declare global {
  interface Window {
    ethereum?: any;
    web3?: Web3;
  }
}

interface HeaderProps {
  balance: number;
  setBalance: (balance: number | ((prev: number) => number)) => void;
  currentAccount: string;
  setCurrentAccount: (account: string) => void;
  isAdmin: boolean;
  betTokenContract: any; // web3.eth.Contract 实例
  web3: Web3 | null;
}

const Header: React.FC<HeaderProps> = ({ 
  balance, 
  setBalance, 
  currentAccount,
  setCurrentAccount,
  isAdmin,
  betTokenContract,
  web3
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantAddress, setGrantAddress] = useState('');
  const [grantAmount, setGrantAmount] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [isGranting, setIsGranting] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);

  // 检查用户是否已领取初始代币
  useEffect(() => {
    const checkClaimStatus = async () => {
      if (currentAccount && betTokenContract) {
        try {
          const claimed = await betTokenContract.methods.hasClaimedInitialTokens(currentAccount).call();
          setHasClaimed(claimed);
        } catch (error) {
          console.error('检查领取状态失败:', error);
        }
      }
    };

    checkClaimStatus();
  }, [currentAccount, betTokenContract]);

  // 获取用户余额
  useEffect(() => {
    const fetchBalance = async () => {
      if (currentAccount && betTokenContract && web3) {
        try {
          const userBalance = await betTokenContract.methods.balanceOf(currentAccount).call();
          // 将余额从wei转换为ether
          const balanceInEther = web3.utils.fromWei(userBalance, 'ether');
          setBalance(parseFloat(balanceInEther));
        } catch (error) {
          console.error('获取余额失败:', error);
        }
      }
    };

    fetchBalance();
  }, [currentAccount, betTokenContract, web3, setBalance]);

  // 监听MetaMask账户切换
  useEffect(() => {
    if (window.ethereum) {
      // 监听账户变化
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // 用户已断开连接
          setCurrentAccount('');
          setBalance(0);
          setHasClaimed(false);
        } else {
          // 用户切换了账户
          setCurrentAccount(accounts[0]);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      
      // 清理函数
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [setCurrentAccount, setBalance]);

  const handleGetCoins = async () => {
    if (!betTokenContract || !currentAccount || !web3) return;
    
    if (hasClaimed) {
      alert('您已经领取过定旌币了！');
      return;
    }

    setIsClaiming(true);
    try {
      const tx = await betTokenContract.methods.claimInitialTokens().send({
        from: currentAccount
      });
      
      setHasClaimed(true);
      
      // 更新余额
      const newBalance = await betTokenContract.methods.balanceOf(currentAccount).call();
      const balanceInEther = web3.utils.fromWei(newBalance, 'ether');
      setBalance(parseFloat(balanceInEther));
      
      alert('成功获取500定旌币！');
    } catch (error: any) {
      console.error('领取代币失败:', error);
      if (error.code === 4001) {
        alert('用户取消了交易');
      } else {
        alert('领取失败，请重试');
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const handleGrantTokens = async () => {
    if (!betTokenContract || !grantAddress || !grantAmount || !web3) {
      alert('请填写完整信息');
      return;
    }

    if (!web3.utils.isAddress(grantAddress)) {
      alert('请输入有效的钱包地址');
      return;
    }

    const amount = parseFloat(grantAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('请输入有效的金额');
      return;
    }

    setIsGranting(true);
    try {
      const amountWei = web3.utils.toWei(grantAmount, 'ether');
      const tx = await betTokenContract.methods.grantTokens(grantAddress, amountWei).send({
        from: currentAccount
      });
      
      alert(`成功向 ${grantAddress} 转赠 ${grantAmount} BET代币`);
      setShowGrantModal(false);
      setGrantAddress('');
      setGrantAmount('');
      
      // 更新管理员余额
      const newBalance = await betTokenContract.methods.balanceOf(currentAccount).call();
      const balanceInEther = web3.utils.fromWei(newBalance, 'ether');
      setBalance(parseFloat(balanceInEther));
    } catch (error: any) {
      console.error('转赠代币失败:', error);
      if (error.code === 4001) {
        alert('用户取消了交易');
      } else {
        alert('转赠失败，请重试');
      }
    } finally {
      setIsGranting(false);
    }
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        // 使用 Web3.js 连接
        const web3Instance = new Web3(window.ethereum);
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const accounts = await web3Instance.eth.getAccounts();
        setCurrentAccount(accounts[0]);
      } catch (error) {
        console.error('连接钱包失败:', error);
      }
    } else {
      alert('请安装 MetaMask!');
    }
  };

  const disconnectWallet = () => {
    setCurrentAccount('');
    setBalance(0);
    setShowDropdown(false);
    setHasClaimed(false);
    alert('已退出账户，请在小狐狸钱包中切换账户后重新连接');
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="welcome-text">欢迎来到竞彩</h1>
        {isAdmin && <span className="admin-badge">管理员</span>}
      </div>
      
      <div className="user-section">
        {currentAccount ? (
          <>
            <div className="account-info">
              <span className="account-address">
                {shortenAddress(currentAccount)}
              </span>
              {isAdmin && <span className="admin-indicator">👑</span>}
            </div>
            <img 
              src="/default-avatar.png" 
              alt="用户头像" 
              className="user-avatar"
              onClick={() => setShowDropdown(!showDropdown)}
              onError={(e) => {
                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236c5ce7'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
              }}
            />
          </>
        ) : (
          <button className="connect-wallet-btn" onClick={connectWallet}>
            连接钱包
          </button>
        )}
        
        {showDropdown && currentAccount && (
          <div className="user-dropdown">
            <img 
              src="/default-avatar.png" 
              alt="用户头像" 
              className="dropdown-avatar"
              onError={(e) => {
                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236c5ce7'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
              }}
            />
            <div className="account-address-full">{currentAccount}</div>
            <div className="balance-text">
              定旌币余额：{balance} BET
            </div>
            {isAdmin && (
              <div className="admin-features">
                <div className="admin-title">管理员功能</div>
                <button 
                  className="admin-btn"
                  onClick={() => setShowGrantModal(true)}
                >
                  转赠代币
                </button>
              </div>
            )}
            <button 
              className={`get-coins-btn ${isClaiming ? 'loading' : ''}`}
              onClick={handleGetCoins}
              disabled={isClaiming || hasClaimed}
            >
              {isClaiming ? '领取中...' : hasClaimed ? '已领取' : '获取定旌币'}
            </button>
            
            {/* 退出账户按钮 */}
            <button 
              className="disconnect-btn"
              onClick={disconnectWallet}
            >
              退出账户
            </button>
          </div>
        )}
      </div>

      {/* 转赠代币模态框 */}
      {showGrantModal && (
        <Portal>
          <div className="grant-modal-overlay" onClick={() => setShowGrantModal(false)}>
            <div className="grant-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="grant-modal-header">
                <h3>转赠代币</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowGrantModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="grant-modal-body">
                <div className="input-group">
                  <label>接收方地址：</label>
                  <input
                    type="text"
                    value={grantAddress}
                    onChange={(e) => setGrantAddress(e.target.value)}
                    placeholder="请输入接收方钱包地址"
                  />
                </div>
                <div className="input-group">
                  <label>转账金额：</label>
                  <input
                    type="number"
                    value={grantAmount}
                    onChange={(e) => setGrantAmount(e.target.value)}
                    placeholder="请输入BET代币数量"
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>
              <div className="grant-modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowGrantModal(false)}
                >
                  取消
                </button>
                <button 
                  className={`confirm-btn ${isGranting ? 'loading' : ''}`}
                  onClick={handleGrantTokens}
                  disabled={isGranting}
                >
                  {isGranting ? '转账中...' : '确认转赠'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </header>
  );
};

export default Header;