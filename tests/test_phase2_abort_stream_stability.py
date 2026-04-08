import os

from playwright.sync_api import Page, expect


def test_phase2_abort_stream_stability(page: Page):
    """中止流式响应后不应卡死，且可继续发起下一次请求。"""
    base_url = os.getenv("E2E_BASE_URL", "http://localhost:8080")
    page.goto(base_url)

    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    expect(input_box).to_be_visible()

    # 第一次请求：触发工具调用后手动停止
    input_box.fill("帮我查询北京今天天气并给出出行建议")
    page.get_by_role("button", name="发送").click()

    stop_btn = page.get_by_label("停止")
    expect(stop_btn).to_be_visible(timeout=15000)
    stop_btn.click()

    expect(page.get_by_text("已手动终止").last).to_be_visible(timeout=30000)

    # 第二次请求：确认中止后仍可正常生成
    input_box.fill("继续，给我一个两天的北京行程")
    page.get_by_role("button", name="发送").click()

    expect(page.get_by_text("任务完成").last).to_be_visible(timeout=60000)

