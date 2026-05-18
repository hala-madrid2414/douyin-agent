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

export interface SidebarSessionItem {
  id: string;
  title: string;
  updatedAt: string;
}

export interface SidebarProps {
  activeId: string | null;
  sessions: SidebarSessionItem[];
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeId,
  sessions,
  onSelectSession,
  onNewChat,
}) => {
  const now = Date.now();
  const groupedHistory = {
    今天: sessions.filter(item => {
      const diff = now - new Date(item.updatedAt).getTime();
      return diff < 24 * 60 * 60 * 1000;
    }),
    昨天: sessions.filter(item => {
      const diff = now - new Date(item.updatedAt).getTime();
      return diff >= 24 * 60 * 60 * 1000 && diff < 48 * 60 * 60 * 1000;
    }),
    前7天: sessions.filter(item => {
      const diff = now - new Date(item.updatedAt).getTime();
      return diff >= 48 * 60 * 60 * 1000;
    }),
  };

  const orderedGroups = ['今天', '昨天', '前7天'] as const;

  return (
    <div className="sidebar-container">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <RobotOutlined
            style={{ color: '#fff', fontSize: '16px', margin: '4px' }}
          />
        </div>
        <span>Douyin Agent</span>
      </div>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        className="new-chat-btn"
        onClick={onNewChat}
      >
        新对话
      </Button>

      <div className="sidebar-history">
        {orderedGroups.map(groupName => {
          const items = groupedHistory[groupName].sort(
            (left, right) =>
              new Date(right.updatedAt).getTime() -
              new Date(left.updatedAt).getTime(),
          );
          if (items.length === 0) return null;
          return (
            <div key={groupName}>
              <div className="history-group-title">{groupName}</div>
              {items.map(item => (
                <React.Fragment key={item.id}>
                  <button
                    type="button"
                    className={`history-item ${activeId === item.id ? 'active' : ''}`}
                    onClick={() => onSelectSession(item.id)}
                  >
                    <MessageOutlined className="history-icon" />
                    <span>{item.title}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>
          );
        })}
      </div>

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
