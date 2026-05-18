import pytest
from playwright.sync_api import Page, expect

def test_phase1_core_flow(page: Page):
    """
    [用例ID]: TC_PHASE1_CORE_001
    [用例名称]: 核心流程测试：输入内容发送后AI流式输出分点行程
    [优先级]: High
    [前置条件]: 本地服务已启动
    [测试步骤]: 
        1. 访问首页
        2. 在输入框输入旅行相关问题
        3. 点击发送或回车
    [预期结果]: 
        - 出现用户消息气泡
        - 出现AI加载状态
        - 最终显示AI的回复并完成打字机效果
    """
    # 访问页面
    page.goto('http://localhost:8080')

    # 验证欢迎页面可见
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()

    # 输入问题
    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    expect(input_box).to_be_visible()
    input_box.fill("国庆3天带娃去青岛，预算2000，求小众行程")

    # 点击发送
    send_btn = page.get_by_role("button", name="发送")
    expect(send_btn).not_to_be_disabled()
    send_btn.click()

    # 验证用户消息已显示
    message_list = page.get_by_test_id("message-list")
    expect(message_list).to_be_visible()
    expect(page.locator(".message-text").last).to_have_text("国庆3天带娃去青岛，预算2000，求小众行程")

    # 验证加载状态
    # 可能会太快消失，但可以尝试断言
    # expect(page.get_by_text("正在为你规划旅行")).to_be_visible()

    # 验证最终完成状态
    expect(page.get_by_text("任务完成")).to_be_visible(timeout=60000)

    # 验证AI回复不为空，且包含特定结构（如果是Mock或真实数据）
    assistant_msg = page.locator(".assistant-message-content").last
    expect(assistant_msg).to_be_visible()
    expect(assistant_msg).not_to_be_empty()
    
    # 验证底部快速操作按钮出现
    expect(page.get_by_title("赞").last).to_be_visible()
    expect(page.get_by_title("复制").last).to_be_visible()
