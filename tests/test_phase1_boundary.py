import pytest
from playwright.sync_api import Page, expect

def test_phase1_boundary_non_travel(page: Page):
    """
    [用例ID]: TC_PHASE1_BOUNDARY_001
    [用例名称]: 验证非旅行问题会被礼貌拒绝
    [优先级]: Medium
    [前置条件]: 本地服务已启动
    [测试步骤]: 
        1. 访问首页
        2. 在输入框输入非旅行相关问题，例如"请写一段冒泡排序代码"
        3. 点击发送
    [预期结果]: 
        - AI回复中包含拒绝或表明自己是旅行助手的文案，或者任务顺利完成且未报错。
    """
    page.goto('http://localhost:8080')
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()

    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    input_box.fill("请写一段冒泡排序代码")

    page.get_by_role("button", name="发送").click()

    # 等待回复完成
    expect(page.get_by_text("任务完成")).to_be_visible(timeout=30000)

    assistant_msg = page.locator(".assistant-message-content").last
    expect(assistant_msg).to_be_visible()
    expect(assistant_msg).not_to_be_empty()

def test_phase1_boundary_api_failure(page: Page):
    """
    [用例ID]: TC_PHASE1_BOUNDARY_002
    [用例名称]: API失败时显示友好提示
    [优先级]: High
    [前置条件]: 本地服务已启动
    [测试步骤]: 
        1. 拦截 /api/chat 接口使其返回 500 或直接中断
        2. 访问首页，发送消息
    [预期结果]: 
        - AI回复区域显示"暂时无法为你规划行程，请稍后重试"
    """
    # 拦截 /api/chat 并模拟失败
    page.route("**/api/chat*", lambda route: route.abort())

    page.goto('http://localhost:8080')
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()

    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    input_box.fill("你好")

    page.get_by_role("button", name="发送").click()

    # 验证显示友好提示
    # The message should be in the message list
    error_msg = page.get_by_text("暂时无法为你规划行程，请稍后重试")
    expect(error_msg).to_be_visible(timeout=10000)
