# 对话系统 API 接口契约文档 (v1.0)

## 基础规范

- **Base URL**: `/api`
- **Content-Type**: `application/json`
- **鉴权**: 所有接口需携带 Token (Header: `Authorization: Bearer <token>`)

### 通用错误码
- `200`: 成功
- `400`: 参数错误
- `401`: 未登录或 Token 失效
- `403`: 无权限访问该资源
- `404`: 资源不存在
- `500`: 服务器内部错误

---

## 阶段一：基础 AI 对话底座

### 1. 新建对话
**POST** `/api/conversation`

**请求参数**
无

**响应数据**
```json
{
  "code": 200,
  "data": {
    "conversationId": "12345678901234567",
    "createdAt": "2023-10-27T10:00:00Z"
  }
}
```

### 2. 发送消息 (非流式)
**POST** `/api/chat`

**请求参数**
```json
{
  "conversationId": "12345678901234567",
  "content": "国庆3天带娃去青岛，预算2000，求小众行程"
}
```

**响应数据**
```json
{
  "code": 200,
  "data": {
    "messageId": "m_123",
    "role": "assistant",
    "content": "好的，这是为您规划的青岛3天亲子游行程...",
    "createdAt": "2023-10-27T10:01:00Z"
  }
}
```

### 3. 发送消息 (SSE流式)
**POST** `/api/chat/stream`

**请求参数**
```json
{
  "conversationId": "12345678901234567",
  "content": "国庆3天带娃去青岛，预算2000，求小众行程"
}
```

**响应数据 (SSE Event)**
```text
event: message
data: {"content": "好的，"}

event: message
data: {"content": "这是为您"}

event: done
data: {"messageId": "m_123", "fullContent": "好的，这是为您..."}
```

### 4. 获取对话详情
**GET** `/api/conversation/:id`

**请求参数**
- 路径参数 `id`: 会话ID

**响应数据**
```json
{
  "code": 200,
  "data": {
    "id": "12345678901234567",
    "title": "青岛亲子游",
    "messages": [
      {
        "id": "m_1",
        "role": "user",
        "content": "去青岛玩",
        "createdAt": "2023-10-27T10:00:00Z"
      },
      {
        "id": "m_2",
        "role": "assistant",
        "content": "好的，推荐...",
        "createdAt": "2023-10-27T10:00:10Z"
      }
    ],
    "updatedAt": "2023-10-27T10:00:10Z"
  }
}
```

### 5. 获取对话列表
**GET** `/api/conversations`

**请求参数**
- `page` (可选, 默认1)
- `pageSize` (可选, 默认20)

**响应数据**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "12345678901234567",
        "title": "青岛亲子游",
        "lastMessagePreview": "好的，推荐...",
        "updatedAt": "2023-10-27T10:00:10Z"
      }
    ],
    "total": 1
  }
}
```

### 6. 删除对话 (补充)
**DELETE** `/api/conversation/:id`

**响应数据**
```json
{
  "code": 200,
  "message": "删除成功"
}
```

---

## 阶段二：Function Call 工具调用

### 1. 获取可用工具列表
**GET** `/api/tools`

**响应数据**
```json
{
  "code": 200,
  "data": [
    {
      "name": "get_weather",
      "description": "获取指定城市的实时天气",
      "parameters": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "城市名称，如：北京"
          }
        },
        "required": ["location"]
      }
    }
  ]
}
```

### 2. 统一 Agent 接口 (流式, 融合直答与工具)
**POST** `/api/agent/stream`

说明：此接口替代阶段一的 `/api/chat/stream`，内部处理工具调度。

**请求参数**
```json
{
  "conversationId": "12345678901234567",
  "content": "北京香山现在的枫叶红了吗？"
}
```

**响应数据 (SSE Event)**
```text
// 1. 触发工具调用时推送状态
event: tool_call
data: {"status": "running", "toolName": "search_scenic_spot", "message": "正在为您查询香山实时枫叶情况..."}

// 2. 工具调用完成后推送结果 (可选, 供前端调试或展示)
event: tool_result
data: {"toolName": "search_scenic_spot", "result": "目前香山红叶变色率约20%..."}

// 3. 模型基于工具结果生成回答
event: message
data: {"content": "根据最新信息，"}

event: message
data: {"content": "目前香山..."}

event: done
data: {"messageId": "m_124"}
```
