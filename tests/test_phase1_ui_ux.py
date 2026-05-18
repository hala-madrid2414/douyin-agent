import pytest
from playwright.sync_api import Page, expect

def test_phase1_ui_ux_empty_input(page: Page):
    """
    [用例ID]: TC_PHASE1_UIUX_001
    [用例名称]: 空内容时禁用发送按钮
    [优先级]: Medium
    [前置条件]: 本地服务已启动
    [测试步骤]: 
        1. 访问首页
        2. 输入框默认空内容
        3. 检查发送按钮是否禁用
        4. 输入内容后检查发送按钮是否启用
        5. 清空内容后检查发送按钮是否再次禁用
    [预期结果]: 
        - 发送按钮的状态与输入框内容是否为空同步
    """
    page.goto('http://localhost:8080')
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()

    send_btn = page.get_by_role("button", name="发送")
    input_box = page.get_by_placeholder("提问或输入 / 使用技能")

    # 1. 默认空内容，发送按钮应禁用
    expect(send_btn).to_be_disabled()

    # 2. 输入内容，发送按钮应启用
    input_box.fill("测试")
    expect(send_btn).not_to_be_disabled()

    # 3. 清空内容，发送按钮应再次禁用
    input_box.fill("")
    expect(send_btn).to_be_disabled()

def test_phase1_ui_ux_enter_to_send(page: Page):
    """
    [用例ID]: TC_PHASE1_UIUX_002
    [用例名称]: 支持回车发送
    [优先级]: High
    [前置条件]: 本地服务已启动
    [测试步骤]: 
        1. 访问首页
        2. 输入内容后按回车
        3. 检查是否成功发送并显示消息
    [预期结果]: 
        - 消息成功发送并出现在对话列表中
    """
    page.goto('http://localhost:8080')
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()

    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    input_box.fill("回车发送测试")
    input_box.press("Enter")

    # 检查消息已发送
    message_list = page.get_by_test_id("message-list")
    expect(message_list).to_be_visible()
    expect(page.locator(".message-text").last).to_have_text("回车发送测试")

    # 等待完成
    expect(page.get_by_text("任务完成")).to_be_visible(timeout=60000)

def test_phase1_ui_ux_quick_prompts(page: Page):
    """
    [用例ID]: TC_PHASE1_UIUX_003
    [用例名称]: 点击欢迎页推荐话题发送
    [优先级]: Medium
    [前置条件]: 本地服务已启动
    [测试步骤]: 
        1. 访问首页
        2. 点击热门话题中的任意一个
    [预期结果]: 
        - 自动发送该话题并跳转到对话框
    """
    page.goto('http://localhost:8080')
    
    # 找到任意一个推荐的话题并点击，比如"热门话题"下的内容
    first_recommendation = page.get_by_text("川西大环线自驾攻略").first
    
    expect(first_recommendation).to_be_visible()
    
    first_recommendation.click()
    
    # 检查是否成功发送
    message_list = page.get_by_test_id("message-list")
    expect(message_list).to_be_visible()
    
    # 验证有用户消息产生
    expect(page.locator(".message-text").last).to_be_visible()
    
    # 等待回复
    expect(page.get_by_text("任务完成")).to_be_visible(timeout=60000)
