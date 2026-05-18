from pathlib import Path


SESSION_TYPES_FILE = Path("src/types/session.ts")
CHAT_STORE_FILE = Path("src/stores/chatStore.ts")
MESSAGE_LIST_FILE = Path("src/routes/components/MessageList/index.tsx")
MESSAGE_LIST_LESS_FILE = Path("src/routes/components/MessageList/MessageList.less")


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_task4_session_type_contains_unified_thoughtchain_node():
    """
    [用例ID]: TC_TASK45_FE_001
    [用例名称]: Session 类型应支持统一 ThoughtChain 节点（规划 + 工具）
    [优先级]: High
    """
    source = _read(SESSION_TYPES_FILE)
    assert "export type ThoughtChainNodeType" in source
    assert "export interface ThoughtChainNode" in source
    assert "type: ThoughtChainNodeType;" in source
    assert "order: number;" in source
    assert "thoughtChain?: ThoughtChainNode[]" in source


def test_task4_chat_store_consumes_planning_and_tool_status_into_thoughtchain():
    """
    [用例ID]: TC_TASK45_FE_002
    [用例名称]: chatStore 应消费 planning/tool_status 并维护 thoughtChain
    [优先级]: High
    """
    source = _read(CHAT_STORE_FILE)
    assert "event.event === 'planning'" in source
    assert "thoughtChain" in source
    assert "type: 'planning'" in source
    assert "type: 'tool'" in source
    assert "order:" in source
    assert "sortThoughtChainByOrder" in source
    assert "toolCallId" in source


def test_task45_message_list_renders_thoughtchain_with_semantic_props():
    """
    [用例ID]: TC_TASK45_FE_003
    [用例名称]: MessageList 应基于 thoughtChain 渲染并使用 ThoughtChain 推荐属性
    [优先级]: High
    """
    source = _read(MESSAGE_LIST_FILE)
    assert "message.thoughtChain?.length" in source
    assert "<ThoughtChain" in source
    assert "line=\"dashed\"" in source
    assert "defaultExpandedKeys" in source
    assert "classNames" in source or "styles" in source
    assert "root: 'thought-chain-root'" in source
    assert "itemIcon: 'thought-chain-item-icon'" in source
    assert "styles={{" in source
    assert "root:" in source
    assert "itemHeader:" in source
    assert "thought-chain-node-title" in source
    assert "thought-chain-node-description" in source


def test_task5_less_contains_thoughtchain_container_and_status_styles():
    """
    [用例ID]: TC_TASK45_FE_004
    [用例名称]: less 应包含 ThoughtChain 容器和状态视觉样式
    [优先级]: Medium
    """
    source = _read(MESSAGE_LIST_LESS_FILE)
    assert ".thought-chain-panel" in source
    assert ".thought-chain-root" in source
    assert ".thought-chain-item" in source
    assert ".thought-chain-item-icon" in source
    assert ".thought-chain-node-loading" in source
    assert ".thought-chain-node-success" in source
    assert ".thought-chain-node-error" in source
    assert ".thought-chain-node-abort" in source
    assert "--thought-chain-status-color" in source
    assert ".assistant-message-footer .message-status" in source
