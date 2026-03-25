import React from 'react';
import { Avatar, Button, Space, Typography } from 'antd';
import { Welcome, Prompts } from '@ant-design/x';
import {
  ShareAltOutlined,
  EllipsisOutlined,
  FireOutlined,
  ReadOutlined,
  BulbOutlined,
  UserOutlined,
  MessageOutlined,
  LayoutOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { HOT_TOPICS, DESIGN_GUIDES } from '@/constants/chat';
import './WelcomeView.less';

const { Title } = Typography;

const iconMap: Record<string, React.ReactNode> = {
  BulbOutlined: <BulbOutlined className="design-guide-icon" />,
  UserOutlined: <UserOutlined className="design-guide-icon" />,
  MessageOutlined: <MessageOutlined className="design-guide-icon" />,
  LayoutOutlined: <LayoutOutlined className="design-guide-icon" />,
};

const WelcomeView: React.FC = () => {
  return (
    <div className="welcome-view">
      {/* 头部区域 */}
      <Welcome
        className="welcome-header"
        variant="borderless"
        icon={
          <Avatar
            size={64}
            src="https://mdn.alipayobjects.com/huamei_7uahnr/afts/img/A*2h8ITp0H8FkAAAAAAAAAAAAADrJ8AQ/original"
          />
        }
        title="你好，我是 Ant Design X"
        description="基于蚂蚁设计，AGI 产品界面解决方案，打造更好的智能视觉~~"
        extra={
          <Space>
            <Button icon={<ShareAltOutlined />} />
            <Button icon={<EllipsisOutlined />} />
          </Space>
        }
      />

      {/* 推荐卡片区域 */}
      <div className="recommendation-cards">
        {/* 左侧：热门话题 */}
        <div className="card-column">
          <div className="column-title">
            <FireOutlined style={{ color: '#ff4d4f' }} />
            <span>热门话题</span>
          </div>
          <Prompts
            vertical
            items={HOT_TOPICS.map((topic, index) => ({
              key: topic.id,
              icon: (
                <div className={`hot-topic-number rank-${index + 1}`}>
                  {index + 1}
                </div>
              ),
              label: topic.title,
              description: topic.description,
            }))}
          />
        </div>

        {/* 右侧：设计指南 */}
        <div className="card-column">
          <div className="column-title">
            <ReadOutlined style={{ color: '#722ed1' }} />
            <span>设计指南</span>
          </div>
          <Prompts
            vertical
            items={DESIGN_GUIDES.map((guide) => ({
              key: guide.id,
              icon: guide.icon ? iconMap[guide.icon] : null,
              label: guide.title,
              description: guide.description,
            }))}
          />
        </div>
      </div>
    </div>
  );
};

export default WelcomeView;
