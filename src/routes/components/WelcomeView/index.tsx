import { DESIGN_GUIDES, HOT_TOPICS } from '@/constants/chat';
import {
  BookOutlined,
  CameraOutlined,
  CarOutlined,
  CompassOutlined,
  EllipsisOutlined,
  EnvironmentOutlined,
  FireOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import type { PromptsProps } from '@ant-design/x';
import { Prompts, Welcome } from '@ant-design/x';
import { Avatar, Button, Space, Typography } from 'antd';
import type React from 'react';
import './WelcomeView.less';

const { Title } = Typography;

const iconMap: Record<string, React.ReactNode> = {
  EnvironmentOutlined: <EnvironmentOutlined className="design-guide-icon" />,
  CarOutlined: <CarOutlined className="design-guide-icon" />,
  CameraOutlined: <CameraOutlined className="design-guide-icon" />,
  BookOutlined: <BookOutlined className="design-guide-icon" />,
};

const renderTitle = (icon: React.ReactElement, title: string) => (
  <Space align="start">
    {icon}
    <span>{title}</span>
  </Space>
);

const items: PromptsProps['items'] = [
  {
    key: 'hot-topics',
    label: renderTitle(
      <FireOutlined style={{ color: '#ff4d4f' }} />,
      '热门话题',
    ),
    description: '你想了解什么？',
    children: HOT_TOPICS.map((topic, index) => ({
      key: topic.id,
      icon: (
        <div className={`hot-topic-number rank-${index + 1}`}>{index + 1}</div>
      ),
      description: topic.title,
    })),
  },
  {
    key: 'design-guide',
    label: renderTitle(
      <CompassOutlined style={{ color: '#722ed1' }} />,
      '旅行指南',
    ),
    description: '如何规划完美的旅程？',
    children: DESIGN_GUIDES.map(guide => ({
      key: guide.id,
      icon: guide.icon ? iconMap[guide.icon] : null,
      description: guide.title,
    })),
  },
];

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
            icon={
              <CompassOutlined style={{ fontSize: 32, color: '#1677ff' }} />
            }
            style={{
              backgroundColor: '#e6f4ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        }
        title="你好，我是你的旅行搭子"
        description="探索世界每一个角落，为你定制独一无二的旅行体验"
        extra={
          <Space>
            <Button icon={<ShareAltOutlined />} />
            <Button icon={<EllipsisOutlined />} />
          </Space>
        }
      />

      {/* 推荐卡片区域 */}
      <div className="recommendation-cards">
        <Prompts
          title="你想要？"
          items={items}
          wrap
          className="custom-prompts-nested"
        />
      </div>
    </div>
  );
};

export default WelcomeView;
