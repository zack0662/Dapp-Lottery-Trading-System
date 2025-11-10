// components/ProjectItem.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Web3 from 'web3';

interface ProjectItemProps {
  project: {
    projectId: number;
    name: string;
    teamA: string;
    teamB: string;
    ticketPrice: string;
    resultTime: number;
    totalPool: string;
    isFinished: boolean;
    isActive: boolean;
    winningOption: number;
    options: string[];
    prizesDistributed: boolean;
  };
  web3: Web3 | null;
  easyBetContract: any;
  isAdmin: boolean;
  currentAccount: string;
  onRefresh: () => void;
}

const ProjectItem: React.FC<ProjectItemProps> = ({ 
  project, 
  web3, 
  easyBetContract, 
  isAdmin, 
  currentAccount,
  onRefresh 
}) => {
  const navigate = useNavigate();
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<number>(0);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);  
  // 格式化截止时间
  const formatDeadline = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return `截止时间：${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}时${date.getMinutes()}分`;
  };

  // 格式化价格
  const formatPrice = (priceWei: string) => {
    if (!web3) return '0';
    return web3.utils.fromWei(priceWei, 'ether');
  };

  // 获取状态文本
  const getStatusText = () => {
    if (project.isFinished) return '已结束';
    if (!project.isActive) return '未开始';
    return '进行中';
  };

  // 获取状态样式类名
  const getStatusClass = () => {
    if (project.isFinished) return 'status-finished';
    if (!project.isActive) return 'status-inactive';
    return 'status-active';
  };

  const handleClick = () => {
    if (project.isActive && !project.isFinished) {
      navigate(`/betting/${project.projectId}`);
    }
  };

  // 检查是否可以开奖
  const canAnnounceResult = () => {
    const now = Math.floor(Date.now() / 1000);
    return isAdmin && !project.isFinished && now >= project.resultTime;
  };

  // 处理激活项目
  const handleActivateProject = async () => {
    if (!easyBetContract || !currentAccount || !web3) return;

    setIsActivating(true);
    try {
      // 先检查项目状态
      const projectInfo = await easyBetContract.methods.getProjectInfo(project.projectId).call();
      
      if (projectInfo.isActive) {
        alert('项目已激活');
        return;
      }
      
      if (projectInfo.isFinished) {
        alert('项目已结束，无法激活');
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      if (now >= projectInfo.resultTime) {
        alert('项目已过期，无法激活');
        return;
      }

      // 执行激活
      const tx = await easyBetContract.methods.activateProject(project.projectId).send({
        from: currentAccount,
        gas: 300000
      });

      console.log('项目激活成功，交易哈希:', tx.transactionHash);
      onRefresh();
      alert('项目已激活！');

    } catch (error: any) {
      console.error('激活项目失败:', error);
      // 更详细的错误信息
      if (error.code === 4001) {
        alert('用户取消了交易');
      } else if (error.message?.includes('Project already active')) {
        alert('项目已激活');
      } else if (error.message?.includes('Cannot activate finished project')) {
        alert('项目已结束，无法激活');
      } else {
        alert('激活失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setIsActivating(false);
    }
  };

  // 处理停用项目
  const handleDeactivateProject = async () => {
    if (!easyBetContract || !currentAccount || !web3) return;

    setIsDeactivating(true);
    try {
      const tx = await easyBetContract.methods.deactivateProject(project.projectId).send({
        from: currentAccount,
        gas: 300000
      });

      console.log('项目停用成功，交易哈希:', tx.transactionHash);
      onRefresh(); // 刷新项目列表
      alert('项目已停用！');

    } catch (error: any) {
      console.error('停用项目失败:', error);
      if (error.code === 4001) {
        alert('用户取消了交易');
      } else {
        alert('停用失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setIsDeactivating(false);
    }
  };

  // 处理开奖
  const handleAnnounceResult = async () => {
    if (!easyBetContract || !currentAccount || !web3) return;
    let projectInfo;
    try {
      // const projectExists = await easyBetContract.methods._projectExists(project.projectId).call();
      // 这是一个合约内部函数，有几个地方都调用了这个函数，所以一直出错
      projectInfo = await easyBetContract.methods.getProjectInfo(project.projectId).call();
      console.log('项目信息:', projectInfo);
    } catch (error) {
      console.error('获取项目信息失败:', error);
      alert('项目不存在或获取项目信息失败');
      return;
    }
    setIsAnnouncing(true);
    try {
      const tx = await easyBetContract.methods.announceResult(
        project.projectId,
        selectedWinner
      ).send({
        from: currentAccount,
        gas: 500000
      });

      console.log('开奖成功，交易哈希:', tx.transactionHash);
      setShowResultModal(false);
      onRefresh(); // 刷新项目列表
      alert('开奖成功！');

    } catch (error: any) {
      console.error('开奖失败:', error);
      if (error.code === 4001) {
        alert('用户取消了交易');
      } else {
        alert('开奖失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setIsAnnouncing(false);
    }
  };

  // 处理分发奖金
  const handleDistributePrizes = async () => {
    if (!easyBetContract || !currentAccount) return;

    setIsDistributing(true);
    try {
      const tx = await easyBetContract.methods.distributeAllPrizes(project.projectId).send({
        from: currentAccount,
        gas: 1000000  // 可能需要较多 gas
      });

      console.log('奖金分发成功，交易哈希:', tx.transactionHash);
      onRefresh();
      alert('奖金已成功分发给所有中奖用户！');

    } catch (error: any) {
      console.error('分发奖金失败:', error);
      if (error.code === 4001) {
        alert('用户取消了交易');
      } else if (error.message?.includes('Prizes already distributed')) {
        alert('奖金已分发过');
      } else {
        alert('分发失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setIsDistributing(false);
    }
  };

  // 检查是否可以点击（只有活跃且未结束的项目可以点击）
  const isClickable = project.isActive && !project.isFinished;

  return (
    <>
      <div 
        className={`project-card ${isClickable ? 'clickable' : 'disabled'}`}
        onClick={handleClick}
      >
        <div className="project-header">
          <h3 className="project-name">{project.name}</h3>
          <span className={`status-badge ${getStatusClass()}`}>
            {getStatusText()}
          </span>
        </div>
        
        <div className="project-teams">
          <span className="team-a">{project.teamA}</span>
          <span className="vs">VS</span>
          <span className="team-b">{project.teamB}</span>
        </div>
        
        <div className="project-details">
          <div className="detail-item">
            <span className="label">票价:</span>
            <span className="value">{formatPrice(project.ticketPrice)} BET</span>
          </div>
          <div className="detail-item">
            <span className="label">奖池:</span>
            <span className="value">{formatPrice(project.totalPool)} BET</span>
          </div>
        </div>
        
        <p className="project-deadline">{formatDeadline(project.resultTime)}</p>
        
        {/* 管理员操作区域 */}
        {isAdmin && (
          <div className="admin-actions">
            {/* 激活/停用按钮 */}
            {!project.isFinished && (
              <>
                {!project.isActive && (
                  <button 
                    className={`activate-btn ${isActivating ? 'loading' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActivateProject();
                    }}
                    disabled={isActivating}
                  >
                    {isActivating ? '激活中...' : '激活项目'}
                  </button>
                )}
                {project.isActive && (
                  <button 
                    className={`deactivate-btn ${isDeactivating ? 'loading' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeactivateProject();
                    }}
                    disabled={isDeactivating}
                  >
                    {isDeactivating ? '停用中...' : '停用项目'}
                  </button>
                )}
              </>
            )}
            
            {/* 开奖按钮 */}
            {canAnnounceResult() && (
              <button 
                className="announce-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowResultModal(true);
                }}
              >
                开奖
              </button>
            )}
            {/* 发送奖金按钮 - 新增 */}
            {project.isFinished && !project.prizesDistributed && (
              <button 
                className={`distribute-btn ${isDistributing ? 'loading' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`确定要将 ${formatPrice(project.totalPool)} BET 奖金分发给所有中奖用户吗？`)) {
                    handleDistributePrizes();
                  }
                }}
                disabled={isDistributing}
              >
                {isDistributing ? '分发中...' : '发送奖金'}
              </button>
            )}
          </div>
        )}

        {/* 显示获胜方（如果已开奖） */}
        {project.isFinished && (
          <div className="winner-info">
            <strong>获胜方: {project.options[project.winningOption]}</strong>
            {/* 显示奖金分发状态 */}
            {project.prizesDistributed && (
              <span className="distributed-badge">奖金已分发</span>
            )}
          </div>
        )}
        
        {!isClickable && (
          <div className="disabled-overlay">
            {project.isFinished ? '竞猜已结束' : '竞猜未开始'}
          </div>
        )}
      </div>

      {/* 开奖模态框 */}
      {showResultModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>选择获胜方</h3>
            <div className="modal-content">
              <p>请选择 {project.name} 的获胜方：</p>
              <div className="winner-options">
                {project.options.map((option, index) => (
                  <label key={index} className="winner-option">
                    <input
                      type="radio"
                      name="winner"
                      value={index}
                      checked={selectedWinner === index}
                      onChange={(e) => setSelectedWinner(Number(e.target.value))}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button 
                className="confirm-btn"
                onClick={handleAnnounceResult}
                disabled={isAnnouncing}
              >
                {isAnnouncing ? '开奖中...' : '确认开奖'}
              </button>
              <button 
                className="cancel-btn" 
                onClick={() => setShowResultModal(false)}
                disabled={isAnnouncing}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectItem;