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

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  time: string;
  messages: ChatMessage[];
}

// 热门话题 Mock 数据
export const HOT_TOPICS: Topic[] = [
  {
    id: 'topic-1',
    title: '川西大环线自驾攻略',
    description: '雪山、草甸、星空，探索国内最美自驾路线。',
  },
  {
    id: 'topic-2',
    title: '哈尔滨冰雪大世界指南',
    description: '南方小土豆的冰城漫游秘籍与保暖穿搭建议。',
  },
  {
    id: 'topic-3',
    title: '周末淄博烧烤特种兵',
    description: '打卡八大局，体验最地道的人间烟火气。',
  },
  {
    id: 'topic-4',
    title: '阿勒泰深度游',
    description: '走进《我的阿勒泰》，感受治愈系的新疆风光。',
  },
];

// 设计指南 Mock 数据
export const DESIGN_GUIDES: Topic[] = [
  {
    id: 'guide-1',
    title: '灵感',
    description: '挖掘全网最火打卡地，提供新鲜有趣的旅行灵感。',
    icon: 'EnvironmentOutlined',
  },
  {
    id: 'guide-2',
    title: '伴游',
    description: '化身私人定制导游，提供最地道的国内游建议。',
    icon: 'CarOutlined',
  },
  {
    id: 'guide-3',
    title: '行程',
    description: '智能规划特种兵或深度游路线，让出行更省心。',
    icon: 'CameraOutlined',
  },
  {
    id: 'guide-4',
    title: '路书',
    description: '分享详细旅行路书，记录美好旅途回忆。',
    icon: 'BookOutlined',
  },
];

// 快捷提示词 Mock 数据
export const QUICK_PROMPTS: Prompt[] = [
  { id: 'prompt-1', text: '热门推荐', icon: 'ArrowUpOutlined' },
  { id: 'prompt-2', text: '周边游', icon: 'AppstoreOutlined' },
  { id: 'prompt-3', text: '避坑指南', icon: 'BookOutlined' },
  { id: 'prompt-4', text: '出行清单', icon: 'DownloadOutlined' },
];

// 历史会话 Mock 数据
export const CHAT_HISTORY: ChatHistoryItem[] = [
  { id: 'history-1', title: '川西自驾线路规划', time: '2小时前' },
  { id: 'history-3', title: '哈尔滨3天2晚攻略', time: '3天前' },
  { id: 'history-4', title: '淄博烧烤打卡地图', time: '1周前' },
  { id: 'history-5', title: '阿勒泰旅游注意事项', time: '2周前' },
];

export const STATIC_AI_REPLY =
  '收到，我会基于当前的旅行偏好为您提供详细的行程规划和游玩建议（本次为前端 Mock 固定回复）。';

export const MOCK_CHAT_SESSIONS: ChatSession[] = [
  {
    id: 'history-1',
    title: '川西自驾线路规划',
    time: '2小时前',
    messages: [
      { id: 'history-1-m1', role: 'user', content: '我想去川西自驾，大概5天时间，有什么推荐的路线吗？' },
      { id: 'history-1-m2', role: 'assistant', content: STATIC_AI_REPLY },
    ],
  },
  {
    id: 'history-5',
    title: '阿勒泰旅游注意事项',
    time: '2周前',
    messages: [
      {
        id: 'history-5-m1',
        role: 'user',
        content: '去新疆阿勒泰玩，温差大吗？需要准备什么衣服？',
      },
      { id: 'history-5-m2', role: 'assistant', content: STATIC_AI_REPLY },
    ],
  },
  {
    id: 'history-3',
    title: '哈尔滨3天2晚攻略',
    time: '3天前',
    messages: [
      { id: 'history-3-m1', role: 'user', content: '南方人第一次去哈尔滨，冰雪大世界和洗浴中心怎么安排比较好？' },
      { id: 'history-3-m2', role: 'assistant', content: STATIC_AI_REPLY },
    ],
  },
  {
    id: 'history-4',
    title: '淄博烧烤打卡地图',
    time: '1周前',
    messages: [
      { id: 'history-4-m1', role: 'user', content: '周末想做一回特种兵去淄博吃烧烤，八大局周边有什么推荐的店铺？' },
      { id: 'history-4-m2', role: 'assistant', content: STATIC_AI_REPLY },
    ],
  },
];