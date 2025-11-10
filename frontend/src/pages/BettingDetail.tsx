import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './BettingDetail.css';
import Web3 from 'web3';

interface BettingDetailProps {
  balance: number;
  setBalance: (balance: number | ((prev: number) => number)) => void;
  currentAccount: string;  
  isAdmin: boolean;
  web3: Web3 | null;
  easyBetContract: any;
  betTokenContract: any;
  betNFTContract: any;
}

interface ProjectInfo {
  name: string;
  teamA: string;
  teamB: string;
  options: string[];
  ticketPrice: string;
  resultTime: number;
  totalPool: string;
  isFinished: boolean;
  isActive: boolean;
  winningOption: number;
  ticketCount: number;
}

interface OrderBookItem {
  tokenId: number;
  price: string;
  seller: string;
  choice: number;
}

interface UserTicket {
  tokenId: number;
  choice: number;
  isListed: boolean;
}

const safeParseInt = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  const num = parseInt(value);
  return isNaN(num) ? defaultValue : num;
};

const safeParseString = (value: any, defaultValue: string = ''): string => {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  return String(value).trim() || defaultValue;
};

const BettingDetail: React.FC<BettingDetailProps> = ({ 
  balance, 
  setBalance,
  currentAccount,
  isAdmin,
  web3,
  easyBetContract,
  betTokenContract,
  betNFTContract
}) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  
  const [selectedChoice, setSelectedChoice] = useState<number>(0);
  const [showBetModal, setShowBetModal] = useState(false);
  const [userTickets, setUserTickets] = useState<UserTicket[]>([]);
  
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  
  const [orders, setOrders] = useState<OrderBookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [userWinningTickets, setUserWinningTickets] = useState<number[]>([]);
  const [claimedPrizes, setClaimedPrizes] = useState<{ [key: number]: boolean }>({});

  const [isProcessing, setIsProcessing] = useState(false);

  // 调试信息
  useEffect(() => {
    console.log('=== BettingDetail 组件状态 ===');
    console.log('projectId:', projectId);
    console.log('easyBetContract:', easyBetContract ? '已连接' : '未连接');
    console.log('currentAccount:', currentAccount);
    console.log('web3:', web3 ? '已连接' : '未连接');
    console.log('loading:', loading);
    console.log('project:', project);
  }, [projectId, easyBetContract, currentAccount, web3, loading, project]);

const refreshData = async () => {
  if (!easyBetContract || !currentAccount || !projectId || !web3 || !betTokenContract || !betNFTContract) {
    console.error('刷新数据: 缺少必要的依赖');
    setError('系统初始化中，请稍后...');
    return;
  }

  try {
    console.log('=== 开始刷新数据 ===');
    setLoading(true);
    setError(null);

    const parsedProjectId = safeParseInt(projectId);
    if (parsedProjectId <= 0) {
      console.error('无效的项目ID:', projectId);
      setError('无效的项目ID');
      setProject(null);
      return;
    }

    console.log('使用项目ID:', parsedProjectId);

    let projectInfo;
    try {
      projectInfo = await easyBetContract.methods.getProjectInfo(parsedProjectId).call();
      console.log('项目信息获取成功:', projectInfo);
    } catch (error) {
      console.error('获取项目信息失败:', error);
      setError('获取项目信息失败，请刷新页面重试');
      setProject(null);
      return;
    }

    const newProject = {
      name: safeParseString(projectInfo.name, '未知项目'),
      teamA: safeParseString(projectInfo.teamA, '队伍A'),
      teamB: safeParseString(projectInfo.teamB, '队伍B'),
      options: Array.isArray(projectInfo.options) ? projectInfo.options : ['选项A', '选项B'],
      ticketPrice: safeParseString(projectInfo.ticketPrice, '0'),
      resultTime: safeParseInt(projectInfo.resultTime),
      totalPool: safeParseString(projectInfo.totalPool, '0'),
      isFinished: Boolean(projectInfo.isFinished),
      isActive: Boolean(projectInfo.isActive),
      winningOption: safeParseInt(projectInfo.winningOption),
      ticketCount: safeParseInt(projectInfo.ticketCount)
    };
    
    setProject(newProject);

    // 3. 并行获取其他数据以提高性能
    await Promise.allSettled([
      refreshOrderBook(parsedProjectId),
      refreshUserTickets(parsedProjectId),
      refreshBalance()
    ]);

    // 4. 如果项目已结束，获取中奖信息
    if (newProject.isFinished) {
      await refreshWinningInfo(parsedProjectId);
    }

    console.log('=== 数据刷新完成 ===');

  } catch (error) {
    console.error('刷新数据总体失败:', error);
    setError('加载数据失败，请刷新页面重试');
  } finally {
    setLoading(false);
  }
};

  // 修复的订单簿刷新函数
  const refreshOrderBook = async (projectIdNum: number) => {
    if (!easyBetContract || !betNFTContract) return;

    try {
      console.log('获取订单簿...');
      const orderBookResult = await easyBetContract.methods.getOrderBook(projectIdNum).call();
      console.log('订单簿原始结果:', orderBookResult);

      let tokenIds = [];
      let prices = [];

      if (Array.isArray(orderBookResult)) {
        tokenIds = orderBookResult[0] || [];
        prices = orderBookResult[1] || [];
      } else if (orderBookResult && typeof orderBookResult === 'object') {
        tokenIds = orderBookResult[0] || [];
        prices = orderBookResult[1] || [];
      }

      console.log('tokenIds:', tokenIds, 'prices:', prices);

      const ordersList: OrderBookItem[] = [];

      if (tokenIds.length > 0 && prices.length > 0) {
        for (let i = 0; i < tokenIds.length; i++) {
          const tokenId = tokenIds[i];
          const price = prices[i];
          
          const tokenIdStr = tokenId?.toString() || '';
          const priceStr = price?.toString() || '';
          
          if (tokenIdStr && priceStr) {
            try {
              const currentOwner = await betNFTContract.methods.ownerOf(tokenIdStr).call();
              const choice = await easyBetContract.methods.getTicketChoice(projectIdNum, tokenIdStr).call();
              
              ordersList.push({
                tokenId: safeParseInt(tokenIdStr),
                price: priceStr,
                seller: currentOwner,
                choice: safeParseInt(choice)
              });
            } catch (error) {
              console.warn(`处理订单 ${tokenIdStr} 失败:`, error);
            }
          }
        }
      }

      setOrders(ordersList);
      console.log('订单簿更新完成，订单数量:', ordersList.length);
    } catch (error) {
      console.error('刷新订单簿失败:', error);
      setOrders([]);
    }
  };

  // 修复的用户彩票刷新函数
const refreshUserTickets = async (projectIdNum: number) => {
  if (!easyBetContract || !betNFTContract || !currentAccount) return;

  try {
    console.log('获取用户彩票...');
    const allUserTickets = await easyBetContract.methods.getUserTickets(currentAccount).call();
    console.log('用户所有彩票:', allUserTickets);

    const projectTickets: UserTicket[] = [];

    for (const tokenId of allUserTickets) {
      const tokenIdStr = tokenId?.toString() || '';
      
      if (tokenIdStr) {
        try {
          const ticketDetails = await easyBetContract.methods.getTicketDetails(tokenIdStr).call();
          const ticketProjectId = safeParseInt(ticketDetails.projectId);
          
          if (ticketProjectId === projectIdNum) {
            const ticketIdNum = safeParseInt(tokenIdStr);
            
            // 获取彩票选择
            let choice = 0;
            try {
              choice = await easyBetContract.methods.getTicketChoice(projectIdNum, tokenIdStr).call();
            } catch (error) {
              console.warn(`获取彩票 ${tokenIdStr} 选择失败:`, error);
              // 使用默认值
              choice = 0;
            }
            // 获取挂单状态
            let isListed = false;
            try {
              isListed = await betNFTContract.methods.isListed(tokenIdStr).call();
            } catch (error) {
              isListed = false;
            }
            projectTickets.push({
              tokenId: ticketIdNum,
              choice: safeParseInt(choice),
              isListed: isListed
            });
          }
        } catch (error) {
          console.warn(`处理彩票 ${tokenIdStr} 失败:`, error);
        }
      }
    }

    setUserTickets(projectTickets);
    console.log('用户彩票更新完成，数量:', projectTickets.length);
  } catch (error) {
    console.error('刷新用户彩票失败:', error);
    setUserTickets([]);
  }
};
  const refreshBalance = async () => {
    if (!betTokenContract || !currentAccount || !web3) return;

    try {
      const userBalance = await betTokenContract.methods.balanceOf(currentAccount).call();
      const balanceInEther = web3.utils.fromWei(userBalance, 'ether');
      setBalance(parseFloat(balanceInEther));
      console.log('余额更新:', balanceInEther, 'BET');
    } catch (error) {
      console.error('刷新余额失败:', error);
    }
  };

  const refreshWinningInfo = async (projectIdNum: number) => {
    if (!easyBetContract) return;

    try {
      console.log('获取中奖信息...');
      const winningTickets: number[] = [];
      const newClaimedPrizes: { [key: number]: boolean } = {};

      for (const ticket of userTickets) {
        try {
          const ticketDetails = await easyBetContract.methods.getTicketDetails(ticket.tokenId.toString()).call();
          if (ticketDetails && ticketDetails.isWinner) {
            winningTickets.push(ticket.tokenId);
            const isClaimed = await easyBetContract.methods.prizeClaimed(projectIdNum, ticket.tokenId).call();
            newClaimedPrizes[ticket.tokenId] = isClaimed;
          }
        } catch (error) {
          console.warn(`检查彩票 ${ticket.tokenId} 中奖状态失败:`, error);
        }
      }

      setUserWinningTickets(winningTickets);
      setClaimedPrizes(newClaimedPrizes);
      console.log('中奖信息更新完成，中奖彩票:', winningTickets);
    } catch (error) {
      console.error('刷新中奖信息失败:', error);
    }
  };

  // 重试机制
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    setLoading(true);
  };

  // 修复的组件加载逻辑
  useEffect(() => {
    const loadProjectData = async () => {
      if (!easyBetContract || !web3 || !projectId) {
        console.log('等待依赖项加载...');
        return;
      }

      try {
        console.log('开始加载项目数据...');
        await refreshData();
      } catch (error) {
        console.error('加载项目数据失败:', error);
        setError('加载项目失败，请刷新页面');
      }
    };

    // 添加延迟，确保所有依赖都已加载
    const timer = setTimeout(() => {
      loadProjectData();
    }, 1000);

    return () => clearTimeout(timer);
  }, [easyBetContract, web3, projectId, retryCount]);

  // 余额更新
  useEffect(() => {
    const updateBalance = async () => {
      if (currentAccount && betTokenContract && web3) {
        try {
          const userBalance = await betTokenContract.methods.balanceOf(currentAccount).call();
          const balanceInEther = web3.utils.fromWei(userBalance, 'ether');
          setBalance(parseFloat(balanceInEther));
        } catch (error) {
          console.error('更新余额失败:', error);
        }
      }
    };

    updateBalance();
  }, [currentAccount, betTokenContract, web3, setBalance]);

  // 处理投注
  const handleBet = (choice: number) => {
    if (!currentAccount) {
      alert('请先连接钱包');
      return;
    }

    if (!project?.isActive || project.isFinished) {
      alert('项目未开始或已结束');
      return;
    }

    setSelectedChoice(choice);
    setShowBetModal(true);
  };

  // 确认投注
  const confirmBet = async () => {
    if (isProcessing) {
      alert('请等待上一个交易完成');
      return;
    }

    console.log('=== 开始投注流程 ===');
    
    if (!easyBetContract || !currentAccount || !web3 || !betTokenContract || !project || !projectId) {
      console.error('必要的依赖缺失');
      return;
    }

    try {
      setIsProcessing(true);
      
      const ticketPriceWei = project.ticketPrice;
      const allowance = await betTokenContract.methods.allowance(currentAccount, easyBetContract.options.address).call();
      
      console.log('当前授权额度:', allowance);
      console.log('需要授权额度:', ticketPriceWei);
      
      if (BigInt(allowance) < BigInt(ticketPriceWei)) {
        console.log('授权额度不足，开始授权...');
        const approveTx = await betTokenContract.methods.approve(
          easyBetContract.options.address,
          ticketPriceWei
        ).send({
          from: currentAccount,
          gas: 100000
        });
        console.log('授权成功，交易哈希:', approveTx.transactionHash);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 静态调用检查
      console.log('执行静态调用检查...');
      try {
        await easyBetContract.methods.purchaseTicket(
          projectId,
          selectedChoice
        ).call({
          from: currentAccount
        });
        console.log('静态调用成功');
      } catch (staticError: any) {
        console.error('静态调用失败:', staticError.message);
        alert('投注条件不满足: ' + staticError.message);
        return;
      }

      // 执行真实交易
      console.log('静态调用检查通过，开始真实交易...');
      const purchaseTx = await easyBetContract.methods.purchaseTicket(
        projectId,
        selectedChoice
      ).send({
        from: currentAccount,
        gas: 500000
      });

      console.log('投注成功，交易哈希:', purchaseTx.transactionHash);
      await refreshData();
      setShowBetModal(false);
      alert('投注成功！');

    } catch (error: any) {
      console.error('真实交易失败:', error);
      alert('交易发送失败: ' + (error.message || '未知错误'));
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理挂单出售
  const handleSell = (ticketId: number) => {
    setSelectedTicketId(ticketId);
    setShowSellModal(true);
  };

  // 确认挂单
  const confirmSell = async () => {
    if (isProcessing) {
      alert('请等待上一个交易完成');
      return;
    }

    if (!easyBetContract || !currentAccount || !selectedTicketId || !sellPrice || !web3 || !betNFTContract || !projectId) {
      console.error('必要的参数缺失');
      return;
    }

    try {
      setIsProcessing(true);

      const priceWei = web3.utils.toWei(sellPrice, 'ether');
      console.log('开始挂单，彩票ID:', selectedTicketId, '价格:', priceWei);

      // 检查彩票状态
      const owner = await betNFTContract.methods.ownerOf(selectedTicketId).call();
      if (owner.toLowerCase() !== currentAccount.toLowerCase()) {
        alert('你不是该彩票的所有者，无法挂单');
        return;
      }

      const isAlreadyListed = await betNFTContract.methods.isListed(selectedTicketId).call();
      if (isAlreadyListed) {
        alert('该彩票已挂单，请先取消现有挂单');
        return;
      }

      // 检查批准状态
      const isApprovedForAll = await betNFTContract.methods.isApprovedForAll(
        currentAccount, 
        easyBetContract.options.address
      ).call();
      
      if (!isApprovedForAll) {
        console.log('执行一次性批准...');
        try {
          const approveTx = await betNFTContract.methods.setApprovalForAll(
            easyBetContract.options.address, 
            true
          ).send({
            from: currentAccount,
            gas: 100000
          });
          console.log('一次性批准成功:', approveTx.transactionHash);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (approveError) {
          console.error('批准失败:', approveError);
          alert('授权失败，无法挂单');
          return;
        }
      }

      // 执行挂单交易
      console.log('执行挂单交易...');
      const tx = await easyBetContract.methods.listTicket(selectedTicketId, priceWei).send({
        from: currentAccount,
        gas: 500000
      });

      console.log('挂单成功，交易哈希:', tx.transactionHash);
      alert('挂单成功！');
      
      await refreshData();
      setShowSellModal(false);
      setSellPrice('');
      setSelectedTicketId(null);

    } catch (error: any) {
      console.error('挂单流程失败:', error);
      alert('挂单失败: ' + (error.message || '未知错误'));
    } finally {
      setIsProcessing(false);
    }
  };

  // 处理购买挂单
  const handleBuyOrder = async (order: OrderBookItem) => {
    if (!easyBetContract || !currentAccount || !betTokenContract || !web3 || !projectId) return;

    try {
      console.log('=== 开始购买挂单 ===');
      
      // 检查并授权积分
      const priceWei = order.price;
      const allowance = await betTokenContract.methods.allowance(
        currentAccount, 
        easyBetContract.options.address
      ).call();
      
      if (BigInt(allowance) < BigInt(priceWei)) {
        console.log('授权额度不足，开始授权...');
        const approveTx = await betTokenContract.methods.approve(
          easyBetContract.options.address,
          priceWei
        ).send({
          from: currentAccount,
          gas: 100000
        });
        console.log('授权成功:', approveTx.transactionHash);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 执行购买
      console.log('执行购买交易...');
      const tx = await easyBetContract.methods.buyFromOrderBook(
        projectId,
        order.tokenId
      ).send({
        from: currentAccount,
        gas: 500000
      });

      console.log('购买成功，交易哈希:', tx.transactionHash);
      await refreshData();
      alert('购买成功！');

    } catch (error: any) {
      console.error('购买挂单失败:', error);
      alert('购买失败: ' + (error.message || '未知错误'));
    }
  };

  // 取消挂单
  const handleCancelSale = async (ticketId: number) => {
    if (isProcessing) {
      alert('请等待上一个交易完成');
      return;
    }

    if (!betNFTContract || !currentAccount) {
      console.error('必要的参数缺失');
      return;
    }

    try {
      setIsProcessing(true);
      
      console.log('=== 开始取消挂单 ===');
      
      // 检查彩票状态
      const owner = await betNFTContract.methods.ownerOf(ticketId).call();
      const isListed = await betNFTContract.methods.isListed(ticketId).call();
      
      if (owner !== currentAccount) {
        alert('你不是该彩票的所有者，无法取消挂单');
        return;
      }

      if (!isListed) {
        alert('该彩票未挂单，无需取消');
        return;
      }

      // 执行取消挂单
      console.log('执行取消挂单...');
      const tx = await betNFTContract.methods.cancelSale(ticketId).send({
        from: currentAccount,
        gas: 200000
      });

      console.log('取消挂单成功，交易哈希:', tx.transactionHash);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refreshData();
      alert('取消挂单成功！');

    } catch (error: any) {
      console.error('取消挂单失败:', error);
      alert('取消挂单失败: ' + (error.message || '未知错误'));
    } finally {
      setIsProcessing(false);
    }
  };

  // 领取奖金
  const handleClaimPrize = async (ticketId: number) => {
    if (!easyBetContract || !currentAccount || !projectId) return;

    try {
      const tx = await easyBetContract.methods.claimPrize(
        projectId,
        ticketId
      ).send({
        from: currentAccount,
        gas: 300000
      });

      console.log('领取奖金成功，交易哈希:', tx.transactionHash);
      await refreshData();
      alert('奖金领取成功！');

    } catch (error: any) {
      console.error('领取奖金失败:', error);
      alert('领取奖金失败: ' + (error.message || '未知错误'));
    }
  };

  // 获取选择文本
  const getChoiceText = (choice: number) => {
    if (!project) return '';
    return project.options[choice] || `选项 ${choice}`;
  };

  // 格式化价格
  const formatPrice = (priceWei: string) => {
    if (!web3) return '0';
    return web3.utils.fromWei(priceWei, 'ether');
  };

  // 格式化时间
  const formatDeadline = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return `截止时间：${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}时${date.getMinutes()}分`;
  };

  // 渲染加载状态
  if (loading) {
    return (
      <div className="betting-detail">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载项目中...</p>
          {retryCount > 0 && <p>重试次数: {retryCount}</p>}
        </div>
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="betting-detail">
        <div className="error-container">
          <h2>加载失败</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button className="retry-btn" onClick={handleRetry}>重试</button>
            <button className="back-btn" onClick={() => navigate('/projects')}>返回项目列表</button>
          </div>
        </div>
      </div>
    );
  }

  // 渲染项目不存在状态
  if (!project) {
    return (
      <div className="betting-detail">
        <div className="error-container">
          <h2>项目不存在</h2>
          <p>项目ID: {projectId}</p>
          <p>请检查项目ID是否正确，或返回项目列表重新选择</p>
          <div className="error-actions">
            <button className="retry-btn" onClick={handleRetry}>重试</button>
            <button className="back-btn" onClick={() => navigate('/projects')}>返回项目列表</button>
          </div>
        </div>
      </div>
    );
  }

  // 正常渲染项目详情
  return (
    <div className="betting-detail">
      {/* 项目信息 */}
      <div className="project-header">
        <h1>{project.name}</h1>
        <p className="project-description">{project.teamA} vs {project.teamB}</p>
        <p className="project-deadline">{formatDeadline(project.resultTime)}</p>
        <p className="ticket-price">票价: {formatPrice(project.ticketPrice)} BET</p>
        <p className="total-pool">总奖池: {formatPrice(project.totalPool)} BET</p>
        <p className="project-status">
          状态: {project.isFinished ? '已结束' : project.isActive ? '进行中' : '未开始'}
          {project.isFinished && project.winningOption !== undefined && (
            <span className="winner-info"> - 获胜方: {getChoiceText(project.winningOption)}</span>
          )}
        </p>
      </div>

      {/* 投注选项 */}
      {!project.isFinished && (
        <div className="betting-options">
          <h2>选择投注选项</h2>
          <div className="options-grid">
            {project.options.map((option, index) => (
              <div key={index} className="option-card">
                <h3>{option}</h3>
                <button 
                  className={`bet-btn ${selectedChoice === index ? 'selected' : ''}`}
                  onClick={() => handleBet(index)}
                  disabled={isProcessing || !project?.isActive || project?.isFinished || !currentAccount}
                >
                  {isProcessing ? '处理中...' : 
                  !currentAccount ? '请连接钱包' : 
                  !project?.isActive ? '未开始' : 
                  project?.isFinished ? '已结束' : '投注'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 用户持有的彩票 */}
      {userTickets.length > 0 && (
        <div className="user-tickets-section">
          <h3>我的彩票</h3>
          <div className="tickets-list">
            {userTickets.map(ticket => (
              <div key={ticket.tokenId} className="ticket-item">
                <div className="ticket-info">
                  <span className="ticket-id">彩票 #{ticket.tokenId}</span>
                  <span className="ticket-choice">选择: {getChoiceText(ticket.choice)}</span>
                </div>
                {!project.isFinished && (
                  ticket.isListed ? (
                    <button 
                      className="cancel-sale-btn"
                      onClick={() => handleCancelSale(ticket.tokenId)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? '处理中...' : '取消挂单'}
                    </button>
                  ) : (
                    <button 
                      className="sell-btn"
                      onClick={() => handleSell(ticket.tokenId)}
                      disabled={isProcessing || !project?.isActive || project?.isFinished}
                    >
                      {isProcessing ? '处理中...' : '挂单出售'}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 中奖彩票 */}
      {project.isFinished && userWinningTickets.length > 0 && (
        <div className="winning-tickets-section">
          <h3>🎉 中奖彩票 🎉</h3>
          <div className="tickets-list">
            {userWinningTickets.map(ticketId => (
              <div key={ticketId} className="ticket-item winning">
                <span>中奖彩票 #{ticketId}</span>
                {claimedPrizes[ticketId] ? (
                  <span className="claimed-badge">已领取</span>
                ) : (
                  <button 
                    className="claim-btn"
                    onClick={() => handleClaimPrize(ticketId)}
                  >
                    领取奖金
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 市场挂单 */}
      <div className="orders-section">
        <h3>市场挂单</h3>
        {orders.length === 0 ? (
          <p className="no-orders">暂无挂单</p>
        ) : (
          <div className="orders-list">
            {orders.map(order => (
              <div key={order.tokenId} className="order-item">
                <div className="order-info">
                  <div className="order-main">
                    <span className="order-choice">{getChoiceText(order.choice)}</span>
                    <span className="order-price">价格: {formatPrice(order.price)} BET</span>
                  </div>
                  <div className="order-details">
                    <span>彩票 ID: #{order.tokenId}</span>
                    <span className="seller-name">
                      卖家: {order.seller.slice(0, 6)}...{order.seller.slice(-4)}
                    </span>
                  </div>
                </div>
                <button 
                  className="buy-order-btn"
                  onClick={() => handleBuyOrder(order)}
                  disabled={!currentAccount || project.isFinished}
                >
                  {!currentAccount ? '请连接钱包' : project.isFinished ? '已结束' : '购买'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 投注确认模态框 */}
      {showBetModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>确认投注</h3>
            <div className="modal-content">
              <p>选项: <strong>{getChoiceText(selectedChoice)}</strong></p>
              <p>票价: <strong>{formatPrice(project.ticketPrice)} BET</strong></p>
              <p>当前余额: <strong>{balance} BET</strong></p>
            </div>
            <div className="modal-actions">
              <button className="confirm-btn" onClick={confirmBet}>确认投注</button>
              <button className="cancel-btn" onClick={() => setShowBetModal(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 出售确认模态框 */}
      {showSellModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>挂单出售</h3>
            <div>
              <div className="ticket-basic-info">
                <p className="ticket-id">出售彩票 #{selectedTicketId}</p>
                {selectedTicketId && (
                  <p className="ticket-choice-info">
                    投注选择: <strong>{getChoiceText(userTickets.find(t => t.tokenId === selectedTicketId)?.choice || 0)}</strong>
                  </p>
                )}
              </div>
              
              <div className="input-group">
                <label>出售价格 (BET):</label>
                <input
                  type="number"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="输入出售价格"
                  min="0"
                  step="0.1"
                />
              </div>
              
              <div className="price-info">
                <div className="price-row">
                  <span>买入价格:</span>
                  <span>{formatPrice(project.ticketPrice)} BET</span>
                </div>
                
                {sellPrice && parseFloat(sellPrice) > 0 && (
                  <>
                    <div className="price-row">
                      <span>出售价格:</span>
                      <span>{sellPrice} BET</span>
                    </div>
                    <div className={`price-comparison ${parseFloat(sellPrice) > parseFloat(formatPrice(project.ticketPrice)) ? 'profit' : parseFloat(sellPrice) < parseFloat(formatPrice(project.ticketPrice)) ? 'loss' : 'equal'}`}>
                      <span>
                        {parseFloat(sellPrice) > parseFloat(formatPrice(project.ticketPrice)) 
                          ? `盈利: +${(parseFloat(sellPrice) - parseFloat(formatPrice(project.ticketPrice))).toFixed(2)} BET`
                          : parseFloat(sellPrice) < parseFloat(formatPrice(project.ticketPrice))
                          ? `亏损: -${(parseFloat(formatPrice(project.ticketPrice)) - parseFloat(sellPrice)).toFixed(2)} BET`
                          : '持平: 0 BET'}
                      </span>
                      {parseFloat(sellPrice) !== parseFloat(formatPrice(project.ticketPrice)) && (
                        <span className="percentage">
                          ({((Math.abs(parseFloat(sellPrice) - parseFloat(formatPrice(project.ticketPrice))) / parseFloat(formatPrice(project.ticketPrice))) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              {sellPrice && parseFloat(sellPrice) > 0 && (
                <div className="market-tips">
                  <ul>
                    <li>如果彩票中奖，奖金将归购买者所有</li>
                    <li>可以随时取消挂单</li>
                  </ul>
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-btn" 
                onClick={() => {
                  setShowSellModal(false);
                  setSellPrice('');
                  setSelectedTicketId(null);
                }}
                disabled={isProcessing}
              >
                {isProcessing ? '处理中...' : '取消'}
              </button>
              <button 
                className="confirm-btn" 
                onClick={confirmSell}
                disabled={!sellPrice || parseFloat(sellPrice) <= 0 || isProcessing}
              >
                {isProcessing ? '挂单中...' : '确认挂单'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BettingDetail;