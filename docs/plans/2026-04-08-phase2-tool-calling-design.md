# 阶段二：Agent核心能力开发——Function Call工具调用详细设计

## 🎯 设计目标

基于阶段一已完成的AI对话底座，构建智能工具调用能力，让旅行助手能够根据用户需求自动调用第三方工具获取实时信息，并将结果自然融入对话中。

## 📋 核心功能需求

### 1. 工具调用能力
- **智能判断**：识别需要实时信息的旅行问题
- **多工具支持**：Tavily搜索、和风天气API、地图API等
- **结果融合**：将工具结果自然融入AI回答，而非直接展示原始数据

### 2. 用户体验优化
- **状态提示**：显示工具调用过程（"正在查询青岛实时天气..."）
- **结果高亮**：关键信息视觉突出
- **重试机制**：支持手动重新调用工具

### 3. 错误处理
- **智能降级**：工具失败时自动降级为模型直答
- **友好提示**：用户看到"暂时无法获取实时信息，为你提供基础建议"

## 🛠️ 第三方工具集成方案

### 1. Tavily搜索工具
**功能定位**：获取旅行相关的实时信息
**典型场景**：
- "北京香山现在枫叶红了吗？"
- "上海迪士尼乐园今天人多吗？"
- "故宫博物院最近有什么展览？"

**API配置**：
```
# .env.local
TAVILY_API_KEY=your_tavily_api_key_here
TAVILY_SEARCH_MAX_RESULTS=5
```

**调用参数**：
```typescript
interface TavilySearchParams {
  query: string;           // 搜索关键词
  search_depth?: 'basic' | 'advanced';
  include_domains?: string[];  // 限定搜索域
  exclude_domains?: string[];  // 排除域
  max_results?: number;    // 最大结果数
  include_answer?: boolean;    // 是否包含AI总结
}
```

### 2. 和风天气API工具
**功能定位**：获取目的地实时天气信息
**典型场景**：
- "青岛明天天气怎么样？"
- "适合去杭州旅游的天气？"
- "三亚未来一周天气预报"

**API配置**（推荐和风天气 QWeather）：
```
# .env.local
QWEATHER_API_KEY=your_qweather_api_key_here
QWEATHER_WEATHER_BASE_URL=https://devapi.qweather.com/v7
QWEATHER_GEO_BASE_URL=https://geoapi.qweather.com/v2
```

**调用参数**：
```typescript
interface WeatherParams {
  cityName: string;        // 城市名称（如“青岛”）
  locationId?: string;     // 和风城市ID（可选，优先级高于cityName）
  type?: 'now' | '3d' | '7d' | '24h'; // 实时/3天/7天/24小时
}
```

### 3. 地图API工具
**功能定位**：获取地理位置、交通、POI信息
**典型场景**：
-"从杭州东站到西湖怎么走？"
- "北京王府井附近有什么好吃的？"
- "深圳机场到市区距离多远？"

**API配置**（推荐高德地图）：
```
# .env.local
GAODE_MAP_API_KEY=your_gaode_api_key_here
```

## 🏗️ LangGraph决策链路设计

### 核心决策流程
```
用户输入 → 意图识别 → 工具需求判断 → 工具选择 → 并行调用 → 结果整合 → 自然语言回答
```

### 决策节点设计

#### 1. 输入分析节点（InputAnalysisNode）
**职责**：分析用户输入，提取关键信息
**输出**：
```typescript
interface InputAnalysis {
  intent: 'travel_planning' | 'weather_query' | 'attraction_info' | 'general_travel';
  entities: {
    locations: string[];
    dates: string[];
    activities: string[];
    preferences: string[];
  };
  requires_realtime_info: boolean;
  confidence: number;
}
```

#### 2. 工具选择节点（ToolSelectionNode）
**职责**：根据分析结果选择合适的工具
**选择逻辑**：
- **Tavily搜索**：需要景点信息、活动信息、实时状况
- **和风天气API**：涉及天气、温度、降雨等问题
- **地图API**：涉及地理位置、交通、路线规划

#### 3. 工具执行节点（ToolExecutionNode）
**职责**：并行执行选中的工具
**特性**：
- 支持并行调用多个工具
- 超时控制（默认10秒）
- 错误隔离（单个工具失败不影响其他）

#### 4. 结果整合节点（ResultIntegrationNode）
**职责**：将工具结果整合为自然语言回答
**整合策略**：
- 过滤无关信息
- 提取关键数据点
- 保持回答的专业性和实用性

## 🔌 后端接口设计

### 1. 统一Agent接口（改造现有`/api/chat`）
```typescript
POST /api/chat
{
  content: string;
  conversationHistory?: Message[];
  enableTools?: boolean;  // 是否启用工具调用
  preferredTools?: string[]; // 优先使用的工具
}
```

### 2. 工具调度接口（新增）
```typescript
POST /api/tools/execute
{
  tools: {
    name: string;
    parameters: any;
  }[];
  timeout?: number;
}
```

### 3. 工具管理接口（新增）
```typescript
GET /api/tools/list          // 获取可用工具列表
GET /api/tools/status        // 获取工具状态
POST /api/tools/test         // 测试工具连接
```

## 🎨 前端展示方案

### 1. 状态提示设计
**工具调用中状态**：
```
正在为你查询青岛实时天气...
正在检索故宫博物院最新展览信息...
正在获取上海迪士尼乐园排队情况...
```

**多工具并行调用**：
```
正在为你查询：实时天气 + 景点信息 + 交通状况...
```

### 2. 结果融合展示
**自然语言融合**：
- 工具结果不直接展示，而是融入AI回答
- 关键信息使用高亮样式
- 保持对话的流畅性和专业性

**示例**：
```
青岛现在（4月）天气很好，气温在15-22°C之间，非常适合旅游。

根据最新的信息：
- **栈桥**：目前游客适中，建议早上9点前或下午4点后前往
- **八大关**：樱花正值盛开期，是最佳观赏时机
- **崂山**：天气晴朗，能见度很好，适合登山观海

建议行程安排：避开周末高峰，工作日出行体验更佳。
```

### 3. 交互增强
**重新调用按钮**：
- 位置：AI消息气泡右下角
- 图标：刷新图标
- 功能：重新执行工具调用

**工具调用详情**（可选）：
- 悬停显示调用的具体工具和时间
- 点击查看详细的工具返回数据

## 🔐 API Key安全配置

### 1. 环境变量管理
```bash
# .env.local（用户本地配置）
TAVILY_API_KEY=tvly-your-key-here
QWEATHER_API_KEY=your-qweather-key-here
GAODE_MAP_API_KEY=your-gaode-key-here

# 可选：工具调用配置
ENABLE_TOOL_CALLING=true
TOOL_CALL_TIMEOUT=10000
MAX_TOOL_RESULTS=5
```

### 2. 安全最佳实践
- **服务端调用**：所有工具调用都在服务端完成，前端不直接接触API Key
- **错误信息脱敏**：日志中不暴露完整的API Key
- **权限控制**：工具调用接口需要会话验证
- **频率限制**：每个用户限制工具调用频率

## 🧪 测试策略

### 1. 工具测试用例
```typescript
// 实时信息测试
const realtimeTestCases = [
  "北京香山现在枫叶红了吗？",
  "上海迪士尼今天人多吗？",
  "青岛明天天气怎么样？",
  "从杭州东站到西湖怎么走？"
];

// 非实时信息测试
const staticTestCases = [
  "青岛有什么好玩的？",
  "怎么规划三亚5日游？",
  "出国旅行需要准备什么？"
];
```

### 2. 错误场景测试
- API Key无效或过期
- 网络超时
- 工具服务不可用
- 返回数据格式异常

## 📊 监控指标

### 1. 工具调用统计
- 调用成功率
- 平均响应时间
- 各工具使用频率
- 错误类型分布

### 2. 用户体验指标
- 工具触发准确率
- 用户满意度
- 重新调用频率
- 对话完成率

## 🚀 实施计划

### 阶段2.1：工具封装（2-3天）
1. Tavily搜索工具封装
2. 和风天气API工具封装
3. 地图API工具封装
4. 统一工具接口设计

### 阶段2.2：LangGraph集成（3-4天）
1. 决策链路搭建
2. 节点逻辑实现
3. 工具选择算法
4. 结果整合逻辑

### 阶段2.3：后端接口开发（2-3天）
1. 统一Agent接口改造
2. 工具调度接口实现
3. 错误处理机制
4. 性能优化

### 阶段2.4：前端适配（2-3天）
1. 状态提示组件
2. 结果展示优化
3. 交互功能实现
4. 用户体验调优

## 🎯 验收标准

### 功能验收
- [ ] 实时旅行问题能准确触发工具调用
- [ ] 工具结果自然融入AI回答
- [ ] 工具失败时自动降级处理
- [ ] 支持多种工具组合调用

### 性能验收
- [ ] 工具调用响应时间 < 5秒
- [ ] 并发工具调用成功率 > 95%
- [ ] 内存使用合理，无内存泄漏

### 用户体验验收
- [ ] 状态提示清晰明了
- [ ] 回答专业性和实用性提升
- [ ] 界面交互流畅自然
- [ ] 错误处理友好

---

**设计确认**：请确认以上设计方案是否符合你的预期？特别是工具选择、展示方式和错误处理策略是否需要调整？
