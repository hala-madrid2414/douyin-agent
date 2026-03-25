export interface Topic {
  id: string;
  title: string;
  description?: string;
  icon?: string;
}

export interface Prompt {
  id: string;
  text: string;
  icon?: string;
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  time: string;
}

// 热门话题 Mock 数据
export const HOT_TOPICS: Topic[] = [
  {
    id: 'topic-1',
    title: 'Ant Design 5.0 的新特性',
    description: '了解 Ant Design 5.0 带来的全新设计语言和开发体验。',
  },
  {
    id: 'topic-2',
    title: '使用 Ant Design X',
    description: '如何使用 Ant Design X 快速构建 AI 驱动的交互界面。',
  },
  {
    id: 'topic-3',
    title: '组件按需加载',
    description: '学习如何在项目中优雅地进行组件和样式的按需加载。',
  },
  {
    id: 'topic-4',
    title: '前端性能优化指南',
    description: '深入了解如何提升 React 应用的加载速度和运行效率。',
  },
  {
    id: 'topic-5',
    title: 'TypeScript 高级技巧',
    description: '掌握 TS 泛型、条件类型等进阶用法，提升代码质量。',
  },
];

// 设计指南 Mock 数据
export const DESIGN_GUIDES: Topic[] = [
  {
    id: 'guide-1',
    title: '意图',
    description: '理解用户需求，提供精准的 AI 响应和建议。',
    icon: 'BulbOutlined',
  },
  {
    id: 'guide-2',
    title: '角色',
    description: '设定 AI 助手的性格和专业领域，建立信任感。',
    icon: 'UserOutlined',
  },
  {
    id: 'guide-3',
    title: '对话',
    description: '设计流畅自然的对话流，处理各种边界情况。',
    icon: 'MessageOutlined',
  },
  {
    id: 'guide-4',
    title: '界面',
    description: '基于 Ant Design 构建一致且美观的视觉体验。',
    icon: 'LayoutOutlined',
  },
];

// 快捷提示词 Mock 数据
export const QUICK_PROMPTS: Prompt[] = [
  { id: 'prompt-1', text: '升级', icon: 'ArrowUpOutlined' },
  { id: 'prompt-2', text: '组件', icon: 'AppstoreOutlined' },
  { id: 'prompt-3', text: 'RICH 指南', icon: 'BookOutlined' },
  { id: 'prompt-4', text: '安装介绍', icon: 'DownloadOutlined' },
];

// 历史会话 Mock 数据
export const CHAT_HISTORY: ChatHistoryItem[] = [
  { id: 'history-1', title: 'React 基础教程', time: '2小时前' },
  { id: 'history-2', title: 'Antd 自定义主题', time: '昨天' },
  { id: 'history-3', title: '如何使用 Vite 部署', time: '3天前' },
  { id: 'history-4', title: 'TypeScript 泛型解析', time: '1周前' },
];
