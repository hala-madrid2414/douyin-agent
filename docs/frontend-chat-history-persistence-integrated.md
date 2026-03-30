# 前端对话历史存储与路由会话标识一体化需求技术文档

## 1. 业务目标
- 在不改后端接口的前提下，为聊天页提供可持续使用的前端会话能力。
- 每次新建对话生成唯一 17 位数字会话 ID，并与路由 `/chat/{id}` 绑定。
- 支持刷新恢复、会话切换、用户维度数据隔离，避免跨用户串读历史。
- 保证本地开发与自动化验证阶段遵守单 Rspack 进程约束，规避缓存写入冲突。

## 2. 范围与非范围
- 范围内：前端本地持久化、路由驱动会话切换、Mock 发送链路写入、自动化测试覆盖。
- 非范围：后端数据库持久化、真实流式模型输出、工具调用链路、服务端会话鉴权。

## 3. 验收标准
- 新建会话后路由进入 `/chat/{17位数字id}`，并存在对应会话实体。
- 若当前已在空白新会话，再次点击“新对话”仅弹窗提示，不重复创建会话。
- 侧边栏切换会话时主区域消息按路由参数切换，路由是当前会话唯一真相。
- 发送后会话摘要更新（更新时间、预览、消息数），刷新后消息可恢复。
- 同一浏览器下不同 `userId` 的会话数据隔离，互不可见。
- 自动化测试覆盖创建、切换、刷新恢复、用户隔离，并遵循测试规范。

## 4. 技术实现概览

### 4.1 状态结构（Zustand）
- 主存储位于 `src/stores/chatStore.ts`，采用 `persist` 中间件持久化到 `localStorage`。
- 顶层状态包含：
  - `activeUserId`：当前用户标识。
  - `byUser`：按用户命名空间分桶的会话数据。
- 用户分桶 `ChatUserBucket` 包含：
  - `conversationsById`：会话实体映射。
  - `order`：按更新时间排序的会话 ID 列表。
  - `draftByConversationId`：草稿映射。
  - `persistedAt`：持久化时间戳。
- 会话实体 `ConversationEntity` 包含标题、时间戳、摘要预览、消息计数、消息列表等字段。

### 4.2 路由规则
- 路由页 `src/routes/chat/[id]/page.tsx` 读取路径参数并传给 `ChatPage`。
- `ChatPage` 会先校验 `id` 是否满足 17 位数字规则：
  - 合法：确保会话存在（不存在则补建）。
  - 非法：兜底跳转到安全默认页，并保留查询参数。
- 新建对话通过 `createConversation` 生成 ID，随后跳转 `/chat/{id}`。
- 若当前已在空白新会话，点击“新对话”弹窗提示并跳过创建，避免同路由冲突。
- 侧边栏点击历史会话后仅通过路由切换驱动主区域渲染。

### 4.3 用户隔离策略
- 通过 `setActiveUser` 切换命名空间，读取 `?userId=` / `?user=` 或本地缓存的用户标识。
- 所有会话读写动作都基于 `activeUserId` 对应分桶执行。
- 浏览器本地存储同步记录 `chat:userId`，便于刷新后恢复当前用户上下文。

### 4.4 缓存策略
- 使用 `CHAT_CACHE_SCHEMA_VERSION` 实现结构版本控制。
- 使用 `CHAT_CACHE_TTL_MS` 控制缓存有效期，超时数据在 `merge` 阶段被丢弃。
- 持久化合并前执行 `sanitizeByUser`，过滤非法结构与失效桶，降低脏数据风险。

### 4.5 发送链路与摘要更新
- `sendMockConversationTurn` 连续写入 user/assistant 两条消息。
- `appendMessage` 在每次写入后更新：
  - `updatedAt`
  - `lastMessagePreview`
  - `messageCount`
  - `order`（最新会话置顶）
- 首条用户消息会回填会话标题，避免侧边栏空标题。

## 5. 自动化测试方案
- 用例文件：`tests/test_static_chat_interactions.py`
- 覆盖场景：
  - 历史会话切换与消息展示。
  - 发送消息后进入会话态与固定回复写入。
  - 新建会话回到欢迎态并进入 `/chat/{id}`；重复点击“新对话”弹窗提示且不重复创建。
  - 刷新后路由保持与消息恢复。
  - 用户命名空间隔离（uA/uB 切换）。
  - 持久化 `order` 的重复会话 ID 被去重，历史列表不出现重复项。
- 失败截图：`tests/conftest.py` 在失败时自动输出到 `reports/`。
- 执行约束：验证期间仅启动一个 `pnpm run dev` 进程，避免并发 Rspack 缓存冲突。

## 6. 交付物清单
- 前端状态与路由实现：`src/stores/chatStore.ts`、`src/routes/components/ChatPage/index.tsx`、`src/routes/chat/[id]/page.tsx`
- Playwright 测试：`tests/test_static_chat_interactions.py`、`tests/conftest.py`
- 本文档：`docs/frontend-chat-history-persistence-integrated.md`
