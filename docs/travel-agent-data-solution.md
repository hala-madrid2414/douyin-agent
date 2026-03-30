# 旅行对话 Agent 全流程数据解决方案（标准化技术文档）

**版本**：v1.0（可落地基线）  
**适用范围**：Modern.js 前端（路由 + Zustand）+ BFF（`/api/*`）+ MongoDB（对话存储）+ SSE 流式输出（阶段一~四演进兼容）  
**核心目标**：把「对话数据结构、前端状态、后端存储、权限隔离、缓存同步、一致性、性能、安全、监控」一次性讲清并可直接落地。

---

## 1. 业务流程与数据边界

### 1.1 业务对象与关系（最小闭环）
- **用户（User）**：通过 Token 标识（`userId`）。
- **对话（Conversation）**：一个用户拥有多个对话。
- **消息（Message）**：属于某个对话，按时间追加；支持 user/assistant/system/tool 等角色扩展。
- **流式输出（SSE）**：消息生成过程在前端以增量片段呈现，但**最终落库为完整 assistant 消息**（或增量落库，见一致性策略）。

**关键约束**
- 对话 **必须强隔离**：任何接口只能访问 `userId` 自己的对话数据。
- 对话 ID **全局唯一**：推荐 17 位数字 ID（雪花/时间序列），作为路由 `/chat/:id` 的主键。

### 1.2 端到端流程（阶段一~二必需）
- **新建对话**：`POST /api/conversation` → 生成 `conversationId` → 插入空对话 → 前端跳转 `/chat/:id`
- **打开对话**：`GET /api/conversation/:id` → 校验 userId → 返回对话详情（或分页消息）
- **发送消息**：`POST /api/chat`（含 `conversationId` + 用户输入 + 关联上下文）→ 校验 userId → 调用大模型 → 生成 assistant 回复 → 落库 → 返回（或 SSE）
- **列出对话**：`GET /api/conversations` → 返回侧边栏列表（标题、更新时间、最后一句摘要等）

---

## 2. 方案选型（2~3 种对比 + 推荐）

### 2.1 方案 A（推荐，v1 最快闭环）：单表单文档存整段 messages
- MongoDB `conversations` 一张集合；每个对话一个文档，`messages` 数组内嵌。
- 优点：实现快、查询简单、事务需求低（单文档原子更新）。
- 风险：MongoDB 单文档 16MB 上限；超长对话需要分页/裁剪/拆表演进。

### 2.2 方案 B（中期演进）：对话与消息拆分
- `conversations`（元信息） + `messages`（按对话分片分页）。
- 优点：无限增长、分页更自然、索引更灵活。
- 成本：接口与一致性复杂度上升（需要双写/事务或幂等补偿）。

### 2.3 方案 C（强审计/高吞吐）：事件流（Event Sourcing）
- 以 append-only 事件表为主，派生会话视图。
- 优点：审计强、可回放。
- 成本：工程复杂，不适合阶段一快速验证。

**结论**：阶段一~二采用 **方案 A**，同时在数据结构中预留 **拆表演进字段**（见 4、5、10 章）。

---

## 3. 前端状态管理机制（Zustand + 路由驱动）

### 3.1 状态结构设计（State Shape）
将状态拆为「会话列表」与「当前会话」，避免互相污染；将“服务端真相”与“本地 UI 临时态”分离。

**推荐状态结构**
- `session`
  - `authToken`（仅内存/安全存储引用，不落日志）
  - `userId`（可选：从 token 解码或由后端返回）
- `conversations`
  - `byId: Record<conversationId, ConversationSummary>`（侧边栏元信息）
  - `order: conversationId[]`（按 `updatedAt` 排序）
  - `loading/error/lastSyncAt`
- `chat`
  - `currentId: conversationId | null`（由路由 `/chat/:id` 决定）
  - `messagesByConvId: Record<conversationId, Message[]>`（可做 LRU）
  - `streaming`
    - `status: idle|connecting|streaming|done|error|aborted`
    - `activeAssistantMessageId`（增量拼接目标）
    - `buffer`（可选：流片段缓冲）
  - `ui`
    - `inputText`
    - `isSending`
    - `draftByConvId`（可选：每个对话草稿）
- `cache`
  - `schemaVersion`
  - `persistedAt`
  - `ttlMs`

**数据对象建议字段**
- `ConversationSummary`: `id, title, updatedAt, createdAt, lastMessagePreview, messageCount, pinned?, archived?`
- `Message`: `id, role, content, createdAt, model?, toolCalls?, status(sending/failed/complete)`

### 3.2 状态流转规则（State Machine）
以“发送消息”为核心链路，必须可恢复、可重试、可中断（SSE）。

**发送流程（推荐：乐观更新 + 服务端校准）**
1. 用户点击发送/回车：前端生成 `clientMessageId`，把 user 消息以 `status=sending` 插入本地
2. 调用后端 `/api/chat`（非流式）或建立 SSE（流式）
3. SSE：先插入一条空的 assistant 消息（`status=streaming`），片段到来即拼接 `content`
4. 成功结束：
   - 将 user 消息 `status=complete`
   - 将 assistant 消息 `status=complete` + 写入最终 `serverMessageId/createdAt`
   - 更新 `ConversationSummary.updatedAt/lastMessagePreview/messageCount`
5. 失败：
   - user 消息标记 `failed`（可重发）
   - assistant 消息标记 `aborted/failed`（可隐藏或保留）
6. 中断（“一键跳过/停止生成”）：
   - 关闭 SSE
   - 当前 assistant 消息 `status=aborted`
   - 若后端支持返回最终全文，可直接以全文覆盖（见 3.4）

### 3.3 状态同步策略（前端 ↔ 后端 ↔ 本地缓存）
**同步原则**
- 路由是“选中哪段对话”的单一真相：`currentId` 只由 `/chat/:id` 驱动。
- 服务端是“数据权威”：本地状态可乐观，但必须能用服务端返回校准。
- 本地缓存只做“启动加速”和“离线兜底”，不做权威来源。

**推荐策略**
- 启动时：从 `localStorage` 读取 `conversations` 列表与最近 N 个对话的消息摘要（或全文），立即渲染
- 同时后台发起：
  - `GET /api/conversations` 拉取列表并合并（按 `updatedAt` 覆盖）
  - 打开某对话时 `GET /api/conversation/:id` 拉取详情校准
- 冲突合并规则（v1 简化）：
  - 以服务端 `updatedAt` 更大者覆盖
  - 本地 `sending/failed` 消息若服务端未出现，保留并提示“待同步/重试”
- SSE 过程中：只更新当前对话的 `messages` 与对应 summary 的 `updatedAt`

### 3.4 缓存失效机制（localStorage）
**缓存对象分层**
- L1：内存 Zustand（运行时）
- L2：`localStorage`（刷新恢复）
- L3：MongoDB（持久化权威）

**失效策略（必须具备）**
- `schemaVersion`：结构变更时整体失效（清空或迁移）
- TTL：`persistedAt + ttlMs` 超时则丢弃缓存（建议 7~30 天）
- LRU：仅持久化最近 `K` 个对话消息（例如 10 个），其余只存 summary
- 安全：若涉及敏感内容或合规要求，**仅缓存 summary** 或加密缓存（见 8 章）

---

## 4. 后端数据库设计方案（MongoDB）

### 4.1 逻辑模型（Logical Model）
- User(1) —— (N) Conversation
- Conversation(1) —— (N) Message（v1 内嵌；v2 可拆表）

### 4.2 物理模型（Physical Model）
**集合：`conversations`（v1 必需）**

**文档结构（推荐）**
```json
{
  "_id": "12345678901234567",
  "userId": "u_789xyz",
  "title": "青岛3天旅行",
  "messages": [
    { "id": "m1", "role": "user", "content": "推荐青岛行程", "createdAt": "..." },
    { "id": "m2", "role": "assistant", "content": "好的，这是推荐...", "createdAt": "..." }
  ],
  "messageCount": 2,
  "createdAt": "...",
  "updatedAt": "...",
  "deletedAt": null,
  "version": 3
}
```

**字段约束（建议用 MongoDB JSON Schema 校验）**
- `_id`：字符串；17 位数字（或更通用的字符串 ID），全局唯一
- `userId`：必填；不可变
- `messages[].role`：枚举（`system|user|assistant|tool`）
- `messages[].content`：字符串；长度上限（防止单条过大）
- `updatedAt`：每次写入必须更新
- `version`：整数递增，用于乐观并发控制

### 4.3 索引策略（Indexing）
最少索引（v1）
- `{ userId: 1, updatedAt: -1 }`：拉取侧边栏列表
- `{ userId: 1, _id: 1 }`：按对话读取（也可由 `_id` + 过滤 userId 完成）
可选索引（按功能开启）
- `{ userId: 1, deletedAt: 1, updatedAt: -1 }`：软删除过滤
- `{ userId: 1, title: "text" }`：标题搜索（谨慎使用 text 索引成本）

### 4.4 分库分表 / 分片规则（Sharding）
v1 可不分片；当满足以下任一条件考虑分片：
- 单集群存储压力显著（TB 级）
- 单用户对话量巨大且热点明显
- 并发读写超过单副本集能力

**推荐分片键**
- `userId`（哈希分片）：天然隔离、负载均衡、权限过滤路径固定
- 避免用 `_id` 作为唯一分片键（会形成按时间写入热点，除非使用哈希）

### 4.5 数据归档与备份机制
**归档**
- 软删除：`deletedAt` 标记；用户可恢复（保留 N 天）
- 冷归档：对 `updatedAt < now - 90d` 的对话迁移至冷集合/冷库（或对象存储），只保留 summary 在热库
- 超长对话：截断早期 messages（保留摘要 + 前若干条 + 后若干条），并将完整历史归档到对象存储

**备份**
- RPO/RTO 指标建议：RPO ≤ 1h，RTO ≤ 4h（按业务重要性调整）
- 每日全量 + 每小时增量（或 Oplog 级备份）
- 备份加密、异地保存、定期演练恢复（每月至少一次抽检）

---

## 5. 数据一致性保障措施

### 5.1 一致性目标分级
- **强一致（必须）**：权限隔离、对话归属校验、写入原子性（单对话内消息追加）
- **最终一致（可接受）**：侧边栏摘要、消息计数、标题自动生成、缓存刷新

### 5.2 幂等与并发控制（后端必须具备）
- 幂等键：前端每次发送生成 `clientRequestId`（或 `clientMessageId`），后端保存到会话或单独幂等表，重复请求返回同一结果
- 乐观锁：使用 `version` 或 `updatedAt` 作为条件更新，避免并发覆盖（例如两端同时写入）
- 原子追加：对 `messages` 使用原子更新（单文档 `$push` + `$set updatedAt`）

### 5.3 SSE 流式的落库策略（两种）
- **策略 1（推荐 v1）**：流式只在内存拼接，结束后一次性落库完整 assistant 消息  
  - 优点：写放大低、实现简单  
  - 风险：中断时可能没有 assistant 结果（可提示“生成中断未保存”）
- **策略 2（增强）**：流式增量落库（每 N 字/每 N 秒一次）  
  - 优点：断线可续、可恢复  
  - 成本：写放大、需要更严格的版本控制/幂等

---

## 6. 性能优化建议（前后端联动）

### 6.1 前端
- 对话列表与当前对话分离渲染，避免每次消息更新导致侧边栏全量重渲染
- 消息虚拟列表（消息多时必需）
- SSE 拼接采用增量更新策略，避免每 token 都触发昂贵渲染（可按 50~100ms 批量刷新）
- 本地只缓存最近 K 个会话全文，其余仅 summary

### 6.2 后端 / MongoDB
- 列表接口只返回 summary 字段（投影），避免回传 `messages`
- 打开对话支持分页（演进方案 B 时自然；方案 A 可做“只取末尾 N 条”）
- 防止 `messages` 无限增长触发 16MB 限制：设定阈值（例如 2000 条或 8MB）后自动归档
- 合理设置超时与重试：大模型调用超时与降级提示（阶段一已有要求）

---

## 7. 扩展性设计原则（面向阶段二~四）

### 7.1 工具调用 / Function Call（阶段二）
- `messages` 结构预留：
  - `toolCalls`（模型请求工具）
  - `toolResults`（工具结构化结果）
- 前端状态预留：`toolStatus`（“正在查询天气…”）

### 7.2 RAG / 知识库（阶段三）
- 增加 `citations`：每条 assistant 消息可附引用来源（知识库 chunkId、URL、标题）
- 知识来源标记：前端根据 `citations[].type` 渲染不同样式（“专属旅行攻略”）

### 7.3 生成式 UI（阶段四）
- assistant 消息可携带：
  - `renderInstruction`：如 `render_travel_plan`
  - `renderData`：结构化 JSON（行程、清单、贴士）
- 前端渲染引擎按指令动态加载组件；解析失败自动降级纯文本

---

## 8. 安全合规要求（必须项）

### 8.1 鉴权与授权
- 所有读写接口必须从 Token 得到 `userId`
- 每次对话访问必须校验：`{ _id: conversationId, userId }` 匹配，否则 403
- 禁止通过仅 `_id` 查询后再判断（避免信息侧漏与时序攻击）

### 8.2 数据保护
- 传输加密：HTTPS
- 存储加密：数据库加密（磁盘/托管加密）；必要时对敏感字段做应用层加密
- 日志脱敏：严禁记录 token、原始用户隐私内容；如需排障只记录 `conversationId`、耗时、错误码

### 8.3 合规与数据生命周期
- 明示用户数据用途与保留期限（隐私政策）
- 支持导出与删除请求（软删除→延迟硬删除）
- 访问审计：记录关键操作（创建对话、删除、导出）

---

## 9. 监控告警指标（Observability）

### 9.1 后端 API
- QPS、P95/P99 延迟、错误率（按路由维度：`/api/chat`, `/api/conversation/:id`, `/api/conversations`）
- 大模型调用：成功率、超时率、平均耗时、限流次数
- SSE：在线连接数、平均会话时长、断连率、客户端主动 abort 率

### 9.2 数据库
- `conversations` 读写延迟、慢查询数量
- 索引命中率、扫描文档数量
- 文档大小分布（监控逼近 16MB 风险）
- 存储增长率、归档作业成功率

### 9.3 告警建议（示例阈值）
- `/api/chat` 错误率 > 2% 持续 5 分钟
- 大模型超时率 > 5% 持续 10 分钟
- 慢查询（>200ms）数量突增 3 倍
- 单日存储增长异常（>历史均值 2 倍）

---

## 10. 风险清单与兜底策略

- **Mongo 单文档 16MB**：设置 messages 上限 + 自动归档 + 中期拆表方案
- **SSE 中断导致结果丢失**：v1 允许；可升级为增量落库或“结束后补拉完整消息”
- **本地缓存污染**：`schemaVersion + TTL` 强制失效
- **并发覆盖**：`version/updatedAt` 乐观锁 + 幂等键
- **越权访问**：所有接口统一中间件校验 `userId` + 数据层过滤

---

## 11. 评审检查清单（可直接用于技术评审）

### 11.1 前端状态与缓存
- 状态结构是否分离：列表 / 当前对话 / streaming / ui 临时态
- 是否定义了消息状态机（sending/streaming/failed/aborted）
- 是否有缓存版本号与 TTL
- 是否有冲突合并与服务端校准策略
- 是否控制了渲染频率与虚拟列表方案

### 11.2 后端与数据库
- 所有接口是否统一鉴权并获取 `userId`
- 查询是否使用 `{userId, _id}` 组合过滤（防越权）
- 是否具备幂等键与并发控制（version/updatedAt）
- 索引是否覆盖核心查询（list by userId + updatedAt）
- 是否有归档策略、备份策略与恢复演练计划

### 11.3 一致性 / 性能 / 安全
- SSE 落库策略是否明确且可解释
- 是否限制单对话增长并有阈值策略
- 日志是否脱敏、敏感信息是否禁止落盘
- 监控指标与告警阈值是否落到具体数值
- 本地开发/测试是否遵守 Modern.js 单 Rspack 进程规则（禁止并发 `pnpm run dev`）

---

## 12. 后续迭代规划模板（直接复制使用）

### 12.1 迭代基本信息
- **迭代名称**：  
- **目标（1 句话）**：  
- **范围（In/Out）**：  
- **风险与缓解**：  
- **验收标准**：  

### 12.2 任务拆分（按数据链路）
1. **前端状态**：新增/调整哪些状态结构与流转规则  
2. **接口契约**：新增/变更哪些 API 入参出参与错误码  
3. **数据模型**：新增字段/索引/约束/迁移策略  
4. **一致性策略**：幂等/重试/并发控制是否需要升级  
5. **缓存策略**：是否调整 TTL、LRU、schemaVersion  
6. **监控告警**：新增哪些指标与阈值  

### 12.3 验证与回滚
- **验证用例**（最少 5 条，含异常与越权）：  
- **回滚策略**（数据/代码/配置）：  
- **数据修复预案**：  

---

## 附录 A：关键决策待确认点（评审用）
- 是否允许在 `localStorage` 缓存用户对话全文（若不允许则只存 summary 或加密）
- 对话消息是否需要分页与“只取末尾 N 条”的标准行为
- SSE 中断时 assistant 消息是否需要“部分保存”
- 归档阈值（按条数/字节/天数）与保留策略（隐私合规）
