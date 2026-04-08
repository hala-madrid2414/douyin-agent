import os

from playwright.sync_api import Page, expect


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
