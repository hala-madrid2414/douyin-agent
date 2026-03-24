# Modern.js Agent 全栈应用目录组织与编码规范

## 1. 范围与背景
本规范旨在为基于 Modern.js 框架的 Agent 全栈应用（类 AI 对话框、生成式 UI）提供统一的开发标准与文件组织逻辑。
核心参考基准：Modern.js 约定式路由与 BFF 架构、Zustand 全局状态管理、Ant Design X (antdx) AI 组件的最佳实践，以及“配置驱动”与“高内聚低耦合”的设计原则。

## 2. 核心维度规范

### A. 全局目录架构 (Global Directory Structure)
- `api/`：存放后端/BFF (Backend for Frontend) API 路由，处理与大模型服务交互、数据库等后端逻辑。
- `src/routes/`：页面目录，遵循 Modern.js 的文件系统路由约定（等同于传统 React 的 pages）。
- `src/components/`：全局共享 UI 组件，包含基于 antdx 二次封装的对话组件等。
- `src/stores/`：全局状态管理（基于 Zustand）。
- `src/hooks/`：全局复用的 Custom Hooks（如封装的对话流式 Hook）。
- `src/constants/`：全局静态配置、Prompt 模板与常量。
- `src/utils/`：全局纯工具函数。
- `src/types/`：全局 TypeScript 类型定义。
- `src/services/`：前端 API 请求与 AI 交互服务层。

### B. 组件划分与引用规则 (Component Structure)
#### 强制规范 (必须执行)
- **目录即组件**：每个组件拥有独立专属文件夹。
- **入口文件**：组件文件夹下的 TSX 入口文件 **必须** 统一命名为 `index.tsx`。
- **组件与目录命名**：组件文件夹名称强制采用 PascalCase (大驼峰) 命名法，需与组件导出名称完全一致。
- **样式文件命名**：组件样式文件采用 Less 预处理器，**必须** 使用 `[ComponentName].less` 命名，禁止使用 `index.less`（如 `ChatPanel.less`）。
- **组件拆分与内聚**：复杂组件内部需通过 `components` 子目录进行子组件拆分，禁止扁平化堆叠代码。
- **组件抽离策略**：
  1. **复用性判定**：存在任何复用可能性的组件，必须存放至 `src/components/common/` 下统一维护；
  2. **非复用组件**：无复用可能性的组件，遵循「谁使用谁维护」，存放在使用方目录下的 `components` 文件夹中（如 `src/routes/chat/components/MessageList/`）。
- **生成式 UI 与 antdx 规范**：使用 antdx 库时，AI 对话相关组件（如 Bubble, Sender）的封装需与业务逻辑解耦，推荐采用「配置驱动」模式渲染消息列表。
- **导入规则**：优先使用 `@/` 路径别名导入组件，仅组件内部子文件引用时可使用相对路径。

### C. 状态管理设计规则 (State Management)
#### 强制规范 (基于 Zustand)
- **状态分层**：
  1. **业务状态**：跨组件/跨页面的共享业务数据（如全局对话上下文、用户信息、Agent 状态），统一由全局 Zustand Store 管理。
  2. **UI 状态**：组件内部交互状态（如输入框 focus 状态、侧边栏展开/收起状态），使用组件内 `useState` 管理，禁止放入全局 Store。
- **Store 文件组织**：
  1. 存放于 `src/stores/` 目录，按业务域拆分（如 `chatStore.ts`、`userStore.ts`）。
  2. 每个文件仅维护一个业务域状态，禁止多业务域状态混杂。
  3. 命名规则：文件命名为 `[业务域]Store.ts`，导出的 Hook 命名为 `use[业务域]Store`。
- **状态更新规则**：
  1. 同步更新：直接在 Store 内定义 setter 方法。
  2. 异步更新：所有异步操作（如 AI 流式响应请求）封装在 Store 的 action 中，组件仅触发 action，不处理异步逻辑。
- **逻辑剥离**：复杂业务与状态流转逻辑封装至 Custom Hooks（命名以 `use` 开头），UI 组件仅负责渲染和调用 Hook。

### D. 工具函数与服务规则 (Utils & Services)
#### 强制规范
- **职责单一**：工具函数必须为纯函数，存放于 `src/utils/`（全局）或组件同级 `utils.ts`（局部）。禁止包含 JSX 或 Hooks 逻辑。
- **AI 交互服务**：与大模型/后端的交互逻辑（Fetch, SSE, WebSocket）统一收敛至 `src/services/` 目录，保持 UI 层逻辑轻量。

### E. 常量配置管理规则 (Constants)
#### 强制规范
- **集中管理**：业务配置、场景配置存放于 `src/constants/`。
- **命名规范**：常量变量名强制使用 `UPPER_CASE_SNAKE_CASE`。
- **类型安全**：所有配置文件必须严格定义 TypeScript 接口，禁止使用 `any`。
- **消除硬编码**：静态文本、枚举、Prompt 模板等必须提取到常量文件，组件代码中禁止出现硬编码字符串/数值。

### F. 跨文件依赖与导入导出规则 (Imports & Exports)
#### 强制规范
- **路径别名**：统一使用 `@/` 指向 `src/` 目录，禁止使用深层相对路径。
- **类型定义分离**：类型导出需明确使用 `export type`，禁止与普通变量/组件混合导出。
- **桶导出 (Barrel Export)**：组件集合需在根目录创建 `index.ts` 统一导出子组件，外部引用时仅导入根目录。
- **禁止循环依赖**：严格检查组件间引用关系，禁止父组件直接引用子组件的具体实现，需通过配置或插槽解耦。