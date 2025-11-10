// components/CreateProjectModal.tsx
import React, { useState } from 'react';
import Web3 from 'web3';

interface CreateProjectModalProps {
  onClose: () => void;
  onCreate: (project: any) => void;
  web3: Web3 | null;
  easyBetContract: any;  // 用到这个合约的createProject方法
  currentAccount: string;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  onClose,
  onCreate,
  web3,
  easyBetContract,
  currentAccount
}) => {
  const [formData, setFormData] = useState({
    name: '',
    teamA: '',
    teamB: '',
    description: '',
    ticketPrice: '10',  // 默认票价为10代币，管理员创建赛事的时候可以进行更改
    resultTime: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!web3 || !easyBetContract) {
      setError('Web3 或合约未初始化');
      return;
    }

    if (!currentAccount) {
      setError('请先连接钱包');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 准备合约调用参数
      const options = [formData.teamA, formData.teamB, '平局'];
      const ticketPriceWei = web3.utils.toWei(formData.ticketPrice, 'ether');
      
      // 将时间转换为时间戳
      const resultTime = Math.floor(new Date(formData.resultTime).getTime() / 1000);

      // 调用智能合约创建项目
      const tx = await easyBetContract.methods.createProject(
        formData.name,
        formData.teamA,
        formData.teamB,
        options,
        ticketPriceWei,
        resultTime
      ).send({
        from: currentAccount,
        gas: 500000
      });

      console.log('交易哈希:', tx.transactionHash);
      
      // 创建成功后调用父组件的回调
      onCreate({
        name: formData.name,
        teamA: formData.teamA,
        teamB: formData.teamB,
        description: formData.description,
        ticketPrice: formData.ticketPrice,
        resultTime: formData.resultTime,
        transactionHash: tx.transactionHash
      });
      // 关闭模态框
      onClose();

    } catch (error: any) {
      console.error('创建赛事失败:', error);
      
      if (error.code === 4001) {
        setError('用户取消了交易');
      } else if (error.message?.includes('revert')) {
        setError('合约执行失败，请检查参数是否正确');
      } else {
        setError('创建赛事失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setIsLoading(false);
    }
    
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // 计算最小日期时间（当前时间之后）
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>创建新赛事</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>赛事名称</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="例如：英雄联盟全球总决赛"
              required
            />
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>战队 A</label>
              <input
                type="text"
                name="teamA"
                value={formData.teamA}
                onChange={handleChange}
                placeholder="例如：T1"
                required
              />
            </div>
            <div className="input-group">
              <label>战队 B</label>
              <input
                type="text"
                name="teamB"
                value={formData.teamB}
                onChange={handleChange}
                placeholder="例如：Gen.G"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>赛事描述</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="赛事详细描述"
              rows={3}
              required
            />
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>票价 (BET)</label>
              <input
                type="number"
                name="ticketPrice"
                value={formData.ticketPrice}
                onChange={handleChange}
                step="1"
                min="1"
                placeholder="BET代币数量"
                required
              />
            </div>
            <div className="input-group">
              <label>截止时间</label>
              <input
                type="datetime-local"
                name="resultTime"
                value={formData.resultTime}
                onChange={handleChange}
                min={getMinDateTime()}
                required
              />
            </div>
          </div>

          <div className="modal-actions">
            <button 
              type="submit" 
              className={`confirm-btn ${isLoading ? 'loading' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? '创建中...' : '创建赛事'}
            </button>
            <button 
              type="button" 
              className="cancel-btn" 
              onClick={onClose}
              disabled={isLoading}
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;