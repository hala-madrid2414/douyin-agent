import os
from pathlib import Path

from playwright.sync_api import Page, expect

CHAT_LAMBDA_FILE = Path("api/lambda/chat/index.ts")
LANGGRAPH_RUNTIME_FILE = Path("api/lambda/chat/langgraph/runtime.ts")


def _read_chat_lambda() -> str:
    return CHAT_LAMBDA_FILE.read_text(encoding="utf-8")


def _read_runtime() -> str:
    return LANGGRAPH_RUNTIME_FILE.read_text(encoding="utf-8")


def _read_orchestration_source() -> str:
    return f"{_read_chat_lambda()}\n{_read_runtime()}"


def test_phase2_tavily_auth_and_request_contract():
    """
    [用例ID]: TC_PHASE2_TAVILY_001
    [用例名称]: Tavily 鉴权与请求结构契约存在
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 chat lambda 源码
        2. 校验 Tavily 请求使用 Authorization Bearer 鉴权
        3. 校验 Tavily 请求体包含核心检索字段
    [预期结果]:
        - 存在 Authorization: Bearer 鉴权头
        - 请求体包含 query / search_depth / max_results / topic
    """
    source = _read_orchestration_source()
    assert "Authorization: `Bearer ${apiKey}`" in source
    assert "query," in source
    assert "search_depth: 'basic'" in source
    assert "max_results: maxResults" in source
    assert "topic: 'general'" in source


def test_phase2_tavily_success_fusion_contract():
    """
    [用例ID]: TC_PHASE2_TAVILY_002
    [用例名称]: Tavily 成功后进入回答融合契约存在
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 chat lambda 源码
        2. 校验 Tavily success 状态上报与 toolContext 注入逻辑
    [预期结果]:
        - 存在 tavily success 状态上报
        - 存在 toolContext 拼接进 finalSystemPrompt 的逻辑
        - 存在“不暴露原始JSON”的融合指令
    """
    source = _read_orchestration_source()
    assert "emitToolStatus(" in source
    assert "'tavily'" in source
    assert "'success'" in source
    assert "if (toolContext) {" in source
    assert "finalSystemPrompt += `\\n\\n以下是联网检索到的参考资料" in source
    assert "不要暴露原始JSON" in source


def test_phase2_tavily_toolchain(page: Page):
    """实时问题触发工具调用后，前端应展示 ThoughtChain 与重查入口。"""
    base_url = os.getenv("E2E_BASE_URL", "http://localhost:8080")
    page.goto(base_url)

    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    expect(input_box).to_be_visible()
    input_box.fill("青岛今天天气怎么样，景点开放情况如何？")

    send_btn = page.get_by_role("button", name="发送")
    expect(send_btn).not_to_be_disabled()
    send_btn.click()

    message_list = page.get_by_test_id("message-list")
    expect(message_list).to_be_visible()

    # ThoughtChain 节点标题，出现即代表 tool_status 事件已被前端消费
    expect(page.get_by_text("联网旅行信息查询")).to_be_visible(timeout=60000)

    # 完成后应该出现“重查工具”入口
    expect(page.get_by_title("重查工具").last).to_be_visible(timeout=60000)

    # 回答融合校验：不应把原始 JSON 结构直接回显在回答里
    assistant_msg = page.locator(".assistant-message-content").last
    expect(assistant_msg).to_be_visible()
    expect(assistant_msg).not_to_contain_text('"results":')
    expect(assistant_msg).not_to_contain_text('{"title":')
