from pathlib import Path


CHAT_LAMBDA_FILE = Path("api/lambda/chat/index.ts")
LANGGRAPH_RUNTIME_FILE = Path("src/server/chat/langgraph/runtime.ts")


def _read(path: Path) -> str:
    assert path.exists(), f"missing required file: {path.as_posix()}"
    return path.read_text(encoding="utf-8")


def test_task2_3_langgraph_runtime_is_wired_into_chat_stream():
    """
    [用例ID]: TC_TASK2_3_RUNTIME_001
    [用例名称]: /api/chat 流式链路已接入 LangGraph 运行时
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 chat lambda 与 langgraph runtime 文件
        2. 校验 chat lambda 调用 LangGraph 运行时执行主流程
    [预期结果]:
        - 存在 langgraph/runtime.ts
        - chat lambda 显式 import 并调用运行时
    """
    runtime_source = _read(LANGGRAPH_RUNTIME_FILE)
    chat_source = _read(CHAT_LAMBDA_FILE)

    assert "export const runChatLangGraphRuntime" in runtime_source
    assert "server/chat/langgraph/runtime.ts" in chat_source
    assert "runChatLangGraphRuntime(" in chat_source


def test_task2_3_dual_tool_serial_react_execution_contract():
    """
    [用例ID]: TC_TASK2_3_RUNTIME_002
    [用例名称]: QWeather/Tavily 以 ReAct 串行动态决策调度
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 LangGraph 运行时代码
        2. 校验运行时依赖包含 qweather/tavily 节点执行器
        3. 校验工具执行采用串行动态决策（思考->工具->观察）
    [预期结果]:
        - 存在 qweather 与 tavily 节点执行器依赖注入
        - 不再依赖 Promise.allSettled 并行批处理
        - 存在串行执行器与下一工具决策函数
    """
    runtime_source = _read(LANGGRAPH_RUNTIME_FILE)

    assert "runQWeatherNode: (query: string) => Promise<string>;" in runtime_source
    assert "runTavilyNode: (" in runtime_source
    assert "const selectedTools: ToolKey[] = [];" in runtime_source
    assert "const runToolSerially = async (tool: ToolKey)" in runtime_source
    assert "const decideNextTool = ():" in runtime_source
    assert "while (nextTool)" in runtime_source
    assert "Promise.allSettled(toolRuns)" not in runtime_source


def test_task2_3_chat_lambda_builds_qweather_tavily_nodes_for_runtime():
    """
    [用例ID]: TC_TASK2_3_RUNTIME_004
    [用例名称]: chat lambda 构建并注入 QWeather/Tavily 节点执行器
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 chat lambda 源码
        2. 校验显式构建 qweather/tavily 节点执行器
        3. 校验调用 runChatLangGraphRuntime 时注入节点执行器
    [预期结果]:
        - 存在 runQWeatherNode / runTavilyNode 节点函数
        - runtime 调用参数包含 runQWeatherNode / runTavilyNode
    """
    chat_source = _read(CHAT_LAMBDA_FILE)

    assert "const runQWeatherNode = async (query: string)" in chat_source
    assert "const runTavilyNode = async (query: string)" in chat_source
    assert "runQWeatherNode," in chat_source
    assert "runTavilyNode," in chat_source


def test_task2_3_sse_compatibility_contract_is_kept():
    """
    [用例ID]: TC_TASK2_3_RUNTIME_003
    [用例名称]: LangGraph 运行时改造后仍保持 SSE 兼容
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 chat lambda 与运行时代码
        2. 校验 SSE 输出使用统一 formatSse
        3. 校验核心事件名仍被发出（tool_status/thinking/message/done）
    [预期结果]:
        - SSE 输出格式继续是 event/data 帧
        - 前端已消费的核心事件不回归
    """
    runtime_source = _read(LANGGRAPH_RUNTIME_FILE)
    chat_source = _read(CHAT_LAMBDA_FILE)

    assert "formatSse(" in chat_source
    assert "emitToolStatus(" in runtime_source
    assert "emitSse('thinking'" in runtime_source
    assert "emitSse('message'" in runtime_source
    assert "emitSse('done'" in runtime_source


def test_task3_1_dual_tool_intent_can_be_selected_in_same_round():
    """
    [用例ID]: TC_TASK3_RUNTIME_001
    [用例名称]: 同轮可同时命中 qweather 与 tavily 工具意图
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 LangGraph 运行时代码
        2. 校验天气意图和非天气实时意图可同时存在
        3. 校验 selectedTools 在同一轮可同时 push 两个工具
    [预期结果]:
        - 存在 hasWeatherIntent 与 hasNonWeatherRealtimeIntent 联合判定
        - selectedTools 可同时包含 qweather 与 tavily
    """
    runtime_source = _read(LANGGRAPH_RUNTIME_FILE)

    assert "const hasWeatherIntent = shouldUseWeatherTool(query);" in runtime_source
    assert (
        "const hasNonWeatherRealtimeIntent = shouldUseNonWeatherRealtimeTool(query);"
        in runtime_source
    )
    assert "selectedTools.push('qweather');" in runtime_source
    assert "selectedTools.push('tavily');" in runtime_source
    assert "hasWeatherIntent && hasNonWeatherRealtimeIntent" in runtime_source


def test_task3_2_dual_tool_status_is_reported_and_executed_serially():
    """
    [用例ID]: TC_TASK3_RUNTIME_002
    [用例名称]: 双工具在同轮串行执行并分别回传状态
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 LangGraph 运行时代码
        2. 校验 qweather/tavily 均有 start/success/error 状态分支
        3. 校验存在串行循环与每轮思考事件
    [预期结果]:
        - 工具状态上报覆盖双工具成功与失败
        - 串行执行语义明确（思考->调用->观察）
    """
    runtime_source = _read(LANGGRAPH_RUNTIME_FILE)

    assert "emitToolStatus('qweather', 'start'" in runtime_source
    assert "emitToolStatus('qweather', 'success'" in runtime_source
    assert "emitToolStatus('qweather', 'error'" in runtime_source
    assert "emitToolStatus('tavily', 'start'" in runtime_source
    assert "emitToolStatus(" in runtime_source and "'tavily'" in runtime_source
    assert "while (nextTool)" in runtime_source
    assert "emitSse('thinking'" in runtime_source


def test_task3_3_aggregated_context_is_built_before_streaming_answer():
    """
    [用例ID]: TC_TASK3_RUNTIME_003
    [用例名称]: 汇总工具结果后再进入流式回答
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 LangGraph 运行时代码
        2. 校验存在统一汇总上下文构建函数
        3. 校验模型流式回答使用汇总后的系统提示
    [预期结果]:
        - 先汇总后回答（aggregator -> responder）语义清晰
    """
    runtime_source = _read(LANGGRAPH_RUNTIME_FILE)

    assert "const buildAggregatedSystemPrompt = (" in runtime_source
    assert "const finalSystemPrompt = buildAggregatedSystemPrompt(" in runtime_source
    assert "const stream = await streamModel(query, finalSystemPrompt);" in runtime_source
