# 静态对话交互（Mock 数据）说明

## 目标
在不接入后端的前提下，激活首页的基础对话交互能力：
- 侧边栏历史会话可点击切换并展示不同的历史消息
- 输入框可发送用户消息，并追加固定的 AI 静态回复
- 开始对话后欢迎视图隐藏；点击“新对话”清空对话并回到欢迎态

## Mock 数据
静态数据统一收敛在 `src/constants/chat.ts`：
- `MOCK_CHAT_SESSIONS`：预置历史会话及其消息列表
- `STATIC_AI_REPLY`：固定 AI 回复内容（不随输入变化）
- `CHAT_HISTORY`：侧边栏历史会话列表数据

## 组件与职责
页面入口：`src/routes/page.tsx`
- 管理会话选择与消息状态（历史会话消息 + 新对话消息）
- 控制主区域渲染：欢迎视图 / 消息列表二选一
- 负责处理发送逻辑：追加用户消息与固定 AI 回复

侧边栏：`src/routes/components/Sidebar/`
- 展示历史会话分组列表
- 受控高亮当前会话
- 提供“新对话”入口并触发回调

消息列表：`src/routes/components/MessageList/`
- 渲染消息气泡（区分 user / assistant 样式）
- 消息变化时自动滚动到底部

输入区：`src/routes/components/InputArea/`
- 维护输入框局部状态
- 支持回车与发送按钮提交
- 空内容时禁用发送按钮

## 自动化测试
测试用例位于 `tests/`：
- `tests/test_static_chat_interactions.py`：覆盖会话切换、发送消息、新对话清空
- `tests/conftest.py`：用例失败时自动截图输出到 `reports/`

执行建议（遵循项目测试规范）：
- 启动本地开发服务：`pnpm run dev`（默认端口 8080）
- 使用项目约定的方式运行 pytest（必要时通过 `with_server.py` 管理服务生命周期）
