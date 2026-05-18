from pathlib import Path


LANGGRAPH_DIR = Path("src/server/chat/langgraph")
CONTRACT_FILE = LANGGRAPH_DIR / "contract.ts"
GRAPH_FILE = LANGGRAPH_DIR / "graph.ts"
RUNTIME_FILE = LANGGRAPH_DIR / "runtime.ts"
CHAT_LAMBDA_FILE = Path("api/lambda/chat/index.ts")
CHAT_STORE_FILE = Path("src/stores/chatStore.ts")


def _read(path: Path) -> str:
    assert path.exists(), f"missing required file: {path.as_posix()}"
    return path.read_text(encoding="utf-8")


def test_task1_sse_contract_minimum_events_and_fields_exist():
    """
    [用例ID]: TC_TASK1_SSE_001
    [用例名称]: SSE 最小事件集合与字段契约已被定义（Task1）
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 contract.ts
        2. 校验事件名集合包含 planning/tool_status/message/done/error/abort
        3. 校验存在标准 SSE 格式化函数（event/data 两行 + 空行）
    [预期结果]:
        - contract.ts 存在且包含关键事件名
        - 使用 `event: ...` + `data: ...` 的 SSE 输出格式
    """
    source = _read(CONTRACT_FILE)

    # 最小集合 + error/abort 语义
    for token in [
        "'planning'",
        "'tool_status'",
        "'message'",
        "'done'",
        "'error'",
        "'abort'",
    ]:
        assert token in source

    # SSE 基本格式：event + data + 空行分隔
    assert "event:" in source
    assert "data:" in source
    assert "\\n\\n" in source


def test_task1_langgraph_graph_spec_nodes_and_edges_exist():
    """
    [用例ID]: TC_TASK1_GRAPH_001
    [用例名称]: LangGraph 节点与边（规划、工具选择、并行执行、汇总、输出）已被定义（Task1）
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 graph.ts
        2. 校验包含关键节点命名
        3. 校验包含边定义（from/to）
    [预期结果]:
        - graph.ts 存在且包含关键节点
        - 存在 edges 结构，至少含 from/to 字段
    """
    source = _read(GRAPH_FILE)

    for node in [
        "planner",
        "tool_selector",
        "tool_exec",
        "aggregator",
        "responder",
    ]:
        assert node in source

    assert "edges" in source
    assert "from" in source
    assert "to" in source


def test_task1_graph_edges_cover_main_path_and_branching():
    """
    [用例ID]: TC_TASK1_GRAPH_002
    [用例名称]: LangGraph 边定义覆盖主路径与工具分支
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 graph.ts
        2. 校验主路径 planner -> tool_selector -> tool_exec -> aggregator -> responder
        3. 校验 tool_selector 支持 has_tools/no_tools 分支
    [预期结果]:
        - 关键边都存在
        - 分支语义通过 when 字段显式定义
    """
    source = _read(GRAPH_FILE)

    for edge_literal in [
        "{ from: 'planner', to: 'tool_selector' }",
        "{ from: 'tool_selector', to: 'tool_exec', when: 'has_tools' }",
        "{ from: 'tool_selector', to: 'aggregator', when: 'no_tools' }",
        "{ from: 'tool_exec', to: 'aggregator' }",
        "{ from: 'aggregator', to: 'responder' }",
    ]:
        assert edge_literal in source


def test_task1_error_abort_semantics_are_consistent_across_backend_and_frontend():
    """
    [用例ID]: TC_TASK1_SEMANTIC_001
    [用例名称]: error/abort 在图执行、SSE 与前端状态三端语义一致
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 runtime.ts / chat lambda / chatStore.ts
        2. 校验中止时 runtime 发出 abort 事件并同步 planning abort
        3. 校验异常时后端通过 SSE error 事件下发
        4. 校验前端显式消费 error 事件并将消息状态置为 error
    [预期结果]:
        - abort 语义具备统一事件与状态落点
        - error 语义具备统一事件与状态落点
    """
    runtime_source = _read(RUNTIME_FILE)
    chat_source = _read(CHAT_LAMBDA_FILE)
    store_source = _read(CHAT_STORE_FILE)

    assert "emitSse('abort', { reason: 'request_aborted' })" in runtime_source
    assert "planningSteps[4].status = 'abort'" in runtime_source

    # 失败时必须发 error 事件，而不是仅 message+done 降级
    assert "emitSse('error'" in chat_source

    # 前端应消费 error 事件并将消息与思考链状态置为 error
    assert "event.event === 'error'" in store_source
    assert "status: 'error'" in store_source
