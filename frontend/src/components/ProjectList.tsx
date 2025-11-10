import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import CreateProjectModal from './CreateProjectModal';
import ProjectItem from './ProjectItem';

interface ProjectListProps {
  isAdmin: boolean;
  currentAccount: string;
  web3: Web3 | null;
  easyBetContract: any;
  betTokenContract: any;
  betNFTContract: any;
}

interface Project {
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
}

const safeParseInt = (value: any, defaultValue: number = 0): number => {
  if (value === null || value === undefined) return defaultValue;
  const num = parseInt(value);
  return isNaN(num) ? defaultValue : num;
};

const safeParseString = (value: any, defaultValue: string = ''): string => {
  if (value === null || value === undefined) return defaultValue;
  return String(value).trim() || defaultValue;
};

const safeParseBoolean = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  return Boolean(value);
};

const ProjectList: React.FC<ProjectListProps> = ({
  isAdmin,
  currentAccount,
  web3,
  easyBetContract,
  betTokenContract,
  betNFTContract
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'active' | 'all'>('active');

  // 获取所有项目（包括不活跃的）
const fetchAllProjects = async () => {
  if (!web3 || !easyBetContract) return;

  setLoading(true);
  setError('');

  try {
    console.log('开始获取所有项目...');
    
    let allProjectIds: string[] = [];
    try {
      allProjectIds = await easyBetContract.methods.getAllProjects().call();
      console.log('通过 getAllProjects 获取的项目ID:', allProjectIds);
    } catch (error) {
      console.warn('getAllProjects 失败，尝试备用方法:', error);
      try {
        const projectCount = await easyBetContract.methods.getProjectCount().call();
        console.log('项目总数:', projectCount);
        const count = safeParseInt(projectCount);
        allProjectIds = Array.from({length: count}, (_, i) => (i + 1).toString());
        console.log('生成的备用项目ID列表:', allProjectIds);
      } catch (countError) {
        console.error('获取项目总数也失败:', countError);
        throw new Error('无法获取项目列表');
      }
    }

    if (allProjectIds.length === 0) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const projectsList: Project[] = [];
    
    for (const projectId of allProjectIds) {
      try {
        const id = safeParseInt(projectId);
        if (id === 0) continue;

        console.log(`获取项目 ${id} 的信息...`);
        
        // 修复：直接获取项目信息，如果失败则跳过
        let projectInfo;
        try {
          projectInfo = await easyBetContract.methods.getProjectInfo(id).call();
          console.log(`项目 ${id} 信息:`, projectInfo);
        } catch (err) {
          console.warn(`获取项目 ${id} 信息失败，项目可能不存在:`, err);
          continue;
        }

        // 检查项目是否有有效名称（作为存在性检查）
        if (!projectInfo.name || projectInfo.name.trim() === '') {
          console.warn(`项目 ${id} 名称为空，跳过`);
          continue;
        }

        const project: Project = {
          projectId: id,
          name: safeParseString(projectInfo.name, `项目 ${id}`),
          teamA: safeParseString(projectInfo.teamA, '队伍A'),
          teamB: safeParseString(projectInfo.teamB, '队伍B'),
          ticketPrice: safeParseString(projectInfo.ticketPrice, '0'),
          resultTime: safeParseInt(projectInfo.resultTime),
          totalPool: safeParseString(projectInfo.totalPool, '0'),
          isFinished: safeParseBoolean(projectInfo.isFinished),
          isActive: safeParseBoolean(projectInfo.isActive),
          winningOption: safeParseInt(projectInfo.winningOption),
          options: Array.isArray(projectInfo.options) ? projectInfo.options : ['选项A', '选项B'],
          prizesDistributed: safeParseBoolean(projectInfo.prizesDistributed)
        };

        console.log(`解析后的项目 ${id}:`, project);
        projectsList.push(project);
        
      } catch (err) {
        console.warn(`处理项目 ${projectId} 时出错:`, err);
        continue;
      }
    }

    console.log('最终项目列表:', projectsList);
    setProjects(projectsList);
    
  } catch (error: any) {
    console.error('获取所有项目失败:', error);
    setError('获取项目列表失败: ' + (error.message || '未知错误'));
  } finally {
    setLoading(false);
  }
};

  // 获取活跃项目
  const fetchActiveProjects = async () => {
    if (!web3 || !easyBetContract) return;

    setLoading(true);
    setError('');

    try {
      const allProjects = await fetchAllProjectsRaw(); // 先获取所有项目
      const activeProjects = allProjects.filter(project => 
        project.isActive && !project.isFinished
      );
      setProjects(activeProjects);
    } catch (error: any) {
      console.error('获取活跃项目失败:', error);
      setError('获取项目列表失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // 获取所有项目的原始数据（不设置状态）
const fetchAllProjectsRaw = async (): Promise<Project[]> => {
  if (!web3 || !easyBetContract) return [];

  try {
    let allProjectIds: string[] = [];
    try {
      allProjectIds = await easyBetContract.methods.getAllProjects().call();
    } catch (error) {
      const projectCount = await easyBetContract.methods.getProjectCount().call();
      const count = safeParseInt(projectCount);
      allProjectIds = Array.from({length: count}, (_, i) => (i + 1).toString());
    }

    const projectsList: Project[] = [];
    
    for (const projectId of allProjectIds) {
      try {
        const id = safeParseInt(projectId);
        if (id === 0) continue;

        // 修复：直接获取项目信息，如果失败则跳过
        let projectInfo;
        try {
          projectInfo = await easyBetContract.methods.getProjectInfo(id).call();
        } catch (err) {
          console.warn(`获取项目 ${id} 信息失败:`, err);
          continue;
        }

        // 检查项目是否有有效名称
        if (!projectInfo.name || projectInfo.name.trim() === '') {
          continue;
        }

        projectsList.push({
          projectId: id,
          name: safeParseString(projectInfo.name, `项目 ${id}`),
          teamA: safeParseString(projectInfo.teamA, '队伍A'),
          teamB: safeParseString(projectInfo.teamB, '队伍B'),
          ticketPrice: safeParseString(projectInfo.ticketPrice, '0'),
          resultTime: safeParseInt(projectInfo.resultTime),
          totalPool: safeParseString(projectInfo.totalPool, '0'),
          isFinished: safeParseBoolean(projectInfo.isFinished),
          isActive: safeParseBoolean(projectInfo.isActive),
          winningOption: safeParseInt(projectInfo.winningOption),
          options: Array.isArray(projectInfo.options) ? projectInfo.options : ['选项A', '选项B'],
          prizesDistributed: safeParseBoolean(projectInfo.prizesDistributed)
        });
      } catch (err) {
        console.warn(`处理项目 ${projectId} 时出错:`, err);
        continue;
      }
    }

    return projectsList;
  } catch (error) {
    console.error('获取所有项目原始数据失败:', error);
    return [];
  }
};

  useEffect(() => {
    const loadProjects = async () => {
      if (web3 && easyBetContract) {
        if (viewMode === 'all') {
          await fetchAllProjects();
        } else {
          await fetchActiveProjects();
        }
      }
    };

    loadProjects();
  }, [web3, easyBetContract, viewMode]);

  const handleCreateProject = async (projectData: any) => {
    console.log('项目创建成功:', projectData);
    
    // 创建成功后，强制刷新项目列表
    if (viewMode === 'all') {
      await fetchAllProjects();
    } else {
      // 如果当前是活跃项目视图，切换到所有项目视图显示新创建的项目
      setViewMode('all');
    }
    
    alert('赛事创建成功！');
  };

  const handleRefresh = async () => {
    if (viewMode === 'all') {
      await fetchAllProjects();
    } else {
      await fetchActiveProjects();
    }
  };

  const getNoProjectsMessage = () => {
    if (isAdmin) {
      if (viewMode === 'all') {
        return '暂无任何赛事，点击"创建赛事"开始第一个竞猜！';
      } else {
        return '暂无进行中的赛事，点击"创建赛事"或切换到"所有项目"查看其他赛事';
      }
    } else {
      return '暂无进行中的赛事';
    }
  };

  if (loading) {
    return (
      <div className="project-list">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="project-list">
      <div className="project-list-header">
        <h2>竞猜项目</h2>
        <div className="header-actions">
          {/* 视图切换按钮 - 仅管理员可见 */}
          {isAdmin && (
            <div className="view-toggle">
              <button 
                className={`toggle-btn ${viewMode === 'active' ? 'active' : ''}`}
                onClick={() => setViewMode('active')}
              >
                进行中
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
                onClick={() => setViewMode('all')}
              >
                所有项目
              </button>
            </div>
          )}
          <button className="refresh-btn" onClick={handleRefresh}>
            刷新
          </button>
          {isAdmin && (
            <button 
              className="create-project-btn"
              onClick={() => setShowCreateModal(true)}
            >
              创建赛事
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={handleRefresh} style={{marginLeft: '10px'}}>重试</button>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="no-projects">
          {getNoProjectsMessage()}
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => (
            <ProjectItem 
              key={project.projectId} 
              project={project}
              web3={web3}
              easyBetContract={easyBetContract}
              isAdmin={isAdmin}
              currentAccount={currentAccount}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateProject}
          web3={web3}
          easyBetContract={easyBetContract}
          currentAccount={currentAccount}
        />
      )}
    </div>
  );
};

export default ProjectList;