# 独立式 AI 应用首页（UI 还原）业务需求文档

## 1. 目标与范围
- 目标：将 Modern.js 默认示例页替换为“独立式 AI 应用首页”视觉效果（参考设计图），用于后续接入对话能力与工作流。
- 范围：仅 UI 还原 + 最小交互（本地状态），不包含真实对话请求、SSE 流式输出、会话持久化、鉴权等后端能力。

## 2. 已实现的功能（按区域）

### 2.1 页面整体布局
- 左侧固定宽度会话侧边栏（Sidebar）。
- 右侧主区域包含：上方欢迎视图（WelcomeView）+ 底部输入区（InputArea）。

实现入口：
- 页面拼装：[page.tsx](file:///f:/agent/douyin-agent/src/routes/page.tsx)

### 2.2 Sidebar（左侧会话侧边栏）
- Logo 区：机器人图标 + 应用名“Douyin Agent”。
- “新对话”主按钮：点击后将当前选中的历史会话置空（仅 UI 状态）。
- 历史会话列表：按“今天 / 昨天 / 前7天”分组展示，点击可切换激活态（灰色背景）。
- 底部入口：个人中心、设置（仅 UI，无路由跳转）。

组件位置：
- 组件：[Sidebar/index.tsx](file:///f:/agent/douyin-agent/src/routes/components/Sidebar/index.tsx)
- 样式：[Sidebar.less](file:///f:/agent/douyin-agent/src/routes/components/Sidebar/Sidebar.less)

### 2.3 WelcomeView（主区域欢迎视图）
- 顶部欢迎条：头像、主标题“你好，我是 Ant Design X”、副标题文案、右上角分享/更多按钮（仅 UI）。
- 中部两列推荐：
  - 热门话题：5 条列表，带 1–5 序号，其中 1/2/3 具备强调色样式。
  - 设计指南：4 条卡片（意图/角色/对话/界面），带图标与描述。

组件位置：
- 组件：[WelcomeView/index.tsx](file:///f:/agent/douyin-agent/src/routes/components/WelcomeView/index.tsx)
- 样式：[WelcomeView.less](file:///f:/agent/douyin-agent/src/routes/components/WelcomeView/WelcomeView.less)

### 2.4 InputArea（底部输入区）
- 快捷提示词：横向 Prompts（升级/组件/RICH 指南/安装介绍），点击会将对应文案填充到输入框。
- 多功能输入框：
  - 左侧附件按钮（仅 UI）。
  - 右侧语音按钮（仅 UI）。
  - 发送按钮：当输入为空时禁用；点击发送后清空输入（仅本地状态，不发请求）。

组件位置：
- 组件：[InputArea/index.tsx](file:///f:/agent/douyin-agent/src/routes/components/InputArea/index.tsx)
- 样式：[InputArea.less](file:///f:/agent/douyin-agent/src/routes/components/InputArea/InputArea.less)

## 3. 静态数据与可替换项

### 3.1 静态数据集中位置
本次 UI 还原的内容均使用 Mock 静态数据驱动，集中在：
- [chat.ts](file:///f:/agent/douyin-agent/src/constants/chat.ts)

包含：
- `HOT_TOPICS`：热门话题列表（建议替换为产品真实热门问题/引导）。
- `DESIGN_GUIDES`：设计指南卡片（可替换为 RICH 四要素或产品能力入口）。
- `QUICK_PROMPTS`：输入区快捷提示词（建议替换为“常用技能/常用意图”）。
- `CHAT_HISTORY`：历史会话列表（后续应来自持久化或接口）。

### 3.2 其他需要替换的静态内容
- 应用名：Sidebar 中的“Douyin Agent”。
  - 位置：[Sidebar/index.tsx](file:///f:/agent/douyin-agent/src/routes/components/Sidebar/index.tsx)
- 头像：WelcomeView 顶部使用了固定头像 URL。
  - 位置：[WelcomeView/index.tsx](file:///f:/agent/douyin-agent/src/routes/components/WelcomeView/index.tsx)
- 欢迎语与副标题：WelcomeView 的 `title` 与 `description`。
  - 位置：[WelcomeView/index.tsx](file:///f:/agent/douyin-agent/src/routes/components/WelcomeView/index.tsx)

## 4. 数据流与状态流转（当前版本）

### 4.1 数据流（Mock → 组件）
- `page.tsx` 负责页面布局，不直接处理业务数据。
- `Sidebar` 从 `CHAT_HISTORY` 读取历史会话，并在组件内按时间字符串规则分组。
- `WelcomeView` 从 `HOT_TOPICS` / `DESIGN_GUIDES` 读取推荐卡片数据。
- `InputArea` 从 `QUICK_PROMPTS` 读取快捷提示词。

### 4.2 本地状态（UI State）
- `Sidebar`：`activeId`（当前激活的会话项 id）。
  - 点击历史项：更新 `activeId`。
  - 点击“新对话”：将 `activeId` 置空，仅表示 UI 进入“新会话”状态。
- `InputArea`：`value`（输入框内容）。
  - 点击快捷提示词：写入对应文本。
  - 点击发送：清空输入；未触发网络请求。

### 4.3 当前未实现的数据流（后续扩展）
- 真实会话 id、消息列表、流式输出、工具调用结果等均未接入。
- 建议后续将“会话状态/消息状态”迁移到 `src/stores/`（Zustand）并通过 `src/services/` 对接 BFF 接口。

## 5. 与规范的对应关系
- 组件组织：页面级组件位于 `src/routes/components/`，目录使用 PascalCase；入口文件为 `index.tsx`；样式为 `[ComponentName].less`。
- 常量抽离：静态数据集中于 `src/constants/chat.ts`，避免组件内硬编码。
- 路径别名：使用 `@/` 指向 `src/`。

相关规范：
- [ARCHITECTURE_CONVENTIONS.md](file:///f:/agent/douyin-agent/docs/ARCHITECTURE_CONVENTIONS.md)
- [WEBAPP_TESTING_CONVENTIONS.md](file:///f:/agent/douyin-agent/docs/WEBAPP_TESTING_CONVENTIONS.md)

## 6. 验收口径（本次范围）
- 页面可正常构建与渲染，无白屏、无 `Unexpected Application Error!`。
- Sidebar / WelcomeView / InputArea 核心 UI 元素可见且布局符合设计图。
- 自动化测试脚本覆盖核心元素并通过：
  - [test_homepage_ui.py](file:///f:/agent/douyin-agent/tests/test_homepage_ui.py)

