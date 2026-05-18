import os

from playwright.sync_api import Page, expect


def test_phase2_qweather_ui_toolchain(page: Page):
    """天气问题应展示和风天气工具链状态与重查入口。"""
    base_url = os.getenv("E2E_BASE_URL", "http://localhost:8080")
    page.goto(base_url)

    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    expect(input_box).to_be_visible()
    input_box.fill("北京明天天气怎么样，穿什么合适？")

    send_btn = page.get_by_role("button", name="发送")
    expect(send_btn).not_to_be_disabled()
    send_btn.click()

    message_list = page.get_by_test_id("message-list")
    expect(message_list).to_be_visible()

    # QWeather 工具状态节点出现，代表 qweather tool_status 已被前端消费
    expect(page.get_by_text("和风天气查询")).to_be_visible(timeout=60000)

    # 任务结束后应可重查工具
    expect(page.get_by_title("重查工具").last).to_be_visible(timeout=60000)

