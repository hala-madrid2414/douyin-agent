import { CHAT_HISTORY } from '@/constants/chat';
import {
  MessageOutlined,
  PlusOutlined,
  RobotOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import React from 'react';
import './Sidebar.less';

export interface SidebarProps {
  activeId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeId,
  onSelectSession,
  onNewChat,
}) => {
  // 模拟分组逻辑
  const groupedHistory = {
    今天: CHAT_HISTORY.filter(
      item => item.time.includes('小时') || item.time.includes('分钟'),
    ),
    昨天: CHAT_HISTORY.filter(item => item.time === '昨天'),
    前7天: CHAT_HISTORY.filter(
      item => item.time.includes('天前') || item.time.includes('周前'),
    ),
  };

  return (
    <div className="sidebar-container">
      {/* Logo 区 */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <RobotOutlined
            style={{ color: '#fff', fontSize: '16px', margin: '4px' }}
          />
        </div>
        <span>Douyin Agent</span>
      </div>

      {/* 新对话按钮 */}
      <Button
        type="primary"
        icon={<PlusOutlined />}
        className="new-chat-btn"
        onClick={onNewChat}
      >
        新对话
      </Button>

      {/* 历史会话列表 */}
      <div className="sidebar-history">
        {Object.entries(groupedHistory).map(([groupName, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={groupName}>
              <div className="history-group-title">{groupName}</div>
              {items.map(item => (
                <React.Fragment key={item.id}>
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: Mockup */}
                  <div
                    className={`history-item ${activeId === item.id ? 'active' : ''}`}
                    onClick={() => onSelectSession(item.id)}
                  >
                    <MessageOutlined className="history-icon" />
                    <span>{item.title}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          );
        })}
      </div>

      {/* 底部设置/用户头像入口 */}
      <div className="sidebar-footer">
        <div className="footer-item">
          <UserOutlined className="footer-icon" />
          <span>个人中心</span>
        </div>
        <div className="footer-item">
          <SettingOutlined className="footer-icon" />
          <span>设置</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
