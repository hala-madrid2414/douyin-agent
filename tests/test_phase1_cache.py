import pytest
from playwright.sync_api import Page, expect

def test_phase1_cache_and_new_chat(page: Page):
    """
    [用例ID]: TC_PHASE1_CACHE_001
    [用例名称]: 缓存测试：刷新页面后对话历史完整保留，「新对话」功能正常
    [优先级]: High
    [前置条件]: 本地服务已启动
    [测试步骤]: 
        1. 访问首页
        2. 发送一条消息，并等待完成
        3. 刷新页面
        4. 验证消息记录依然存在
        5. 点击侧边栏「新对话」按钮
        6. 验证当前消息区清空，回到了欢迎页
    [预期结果]: 
        - 刷新页面后，历史消息保留
        - 点击新对话后，显示欢迎页，输入框清空
    """
    page.goto('http://localhost:8080')
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()

    # 1. 发送消息
    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    input_box.fill("测试缓存功能")
    page.get_by_role("button", name="发送").click()

    # 确保发送成功，并且有回复
    expect(page.get_by_text("任务完成")).to_be_visible(timeout=60000)
    expect(page.locator(".message-text").last).to_have_text("测试缓存功能")

    # 2. 刷新页面
    page.reload()

    # 3. 验证消息是否被恢复
    # MessageList应该存在
    expect(page.get_by_test_id("message-list")).to_be_visible()
    expect(page.locator(".message-text").last).to_have_text("测试缓存功能")

    # 4. 点击新对话
    new_chat_btn = page.get_by_role("button", name="新对话")
    expect(new_chat_btn).to_be_visible()
    new_chat_btn.click()

    # 5. 验证是否清空当前消息并回到欢迎页
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()
    expect(page.get_by_test_id("message-list")).not_to_be_visible()
    
    # 并且侧边栏有之前历史记录的列表
    # 侧边栏的"测试缓存功能"应该在列表中
    expect(page.locator(".history-item").filter(has_text="测试缓存功能")).to_be_visible()
