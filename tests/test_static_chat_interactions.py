import os
import re
from playwright.sync_api import Page, expect


BASE_URL = os.getenv("BASE_URL", "http://localhost:8080")
AI_REPLY_SUBSTRING = "前端 Mock 固定回复"
CHAT_ROUTE_PATTERN = re.compile(r".*/chat/\d{17}$")


def test_switch_history_session_shows_messages(page: Page):
    """
    [用例ID]: TC_CHAT_001
    [用例名称]: 点击侧边栏历史会话可切换并展示对应消息列表
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 访问首页
        2. 点击侧边栏历史会话“React 基础教程”
        3. 验证欢迎视图隐藏，消息列表展示，并包含预置消息内容
    [预期结果]: 主区域切换为消息列表并展示所选会话的消息
    """
    page.goto(BASE_URL)

    expect(page.get_by_text("你好，我是 Ant Design X")).to_be_visible()
    page.get_by_text("React 基础教程", exact=True).click()

    expect(page.get_by_text("你好，我是 Ant Design X")).not_to_be_visible()
    expect(page.get_by_test_id("message-list")).to_be_visible()
    expect(page.get_by_text("帮我回顾一下 React 的核心概念。")).to_be_visible()
    expect(page.get_by_text(AI_REPLY_SUBSTRING)).to_be_visible()
    expect(page).to_have_url(CHAT_ROUTE_PATTERN)


def test_send_message_appends_user_and_fixed_ai_reply(page: Page):
    """
    [用例ID]: TC_CHAT_002
    [用例名称]: 发送消息后展示用户消息与固定 AI 回复并进入对话态
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 访问首页
        2. 在输入框输入文本并回车发送
        3. 验证欢迎视图隐藏，消息列表追加用户消息与固定 AI 回复
    [预期结果]: 输入可发送，发送后消息追加且固定 AI 回复出现
    """
    page.goto(BASE_URL)

    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    expect(input_box).to_be_visible()

    user_text = "hello mock"
    input_box.fill(user_text)
    input_box.press("Enter")

    expect(page.get_by_text("你好，我是 Ant Design X")).not_to_be_visible()
    expect(page.get_by_test_id("message-list")).to_be_visible()
    expect(
        page.get_by_test_id("message-list").get_by_text(user_text, exact=True)
    ).to_be_visible()
    expect(page.get_by_text(AI_REPLY_SUBSTRING)).to_be_visible()
    expect(page).to_have_url(CHAT_ROUTE_PATTERN)


def test_new_chat_clears_messages_and_shows_welcome(page: Page):
    """
    [用例ID]: TC_CHAT_003
    [用例名称]: 新对话可清空当前对话并回到欢迎态
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 访问首页并进入任一历史会话
        2. 点击“新对话”
        3. 验证欢迎视图出现且消息列表不展示
    [预期结果]: 新对话清空对话并回到欢迎态
    """
    page.goto(BASE_URL)

    page.get_by_text("React 基础教程", exact=True).click()
    expect(page.get_by_test_id("message-list")).to_be_visible()
    expect(page).to_have_url(CHAT_ROUTE_PATTERN)

    page.get_by_role("button", name="新对话").click()
    expect(page.get_by_text("你好，我是 Ant Design X")).to_be_visible()
    expect(page.get_by_test_id("message-list")).not_to_be_visible()
    expect(page).to_have_url(CHAT_ROUTE_PATTERN)


def test_refresh_keeps_route_and_restores_messages(page: Page):
    """
    [用例ID]: TC_CHAT_004
    [用例名称]: 刷新页面后保留路由并恢复会话消息
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 访问首页并发送一条消息
        2. 记录当前路由并刷新页面
        3. 验证路由不变且消息仍可见
    [预期结果]: 对话历史可持久化恢复
    """
    page.goto(BASE_URL)

    user_text = "refresh-restore-case"
    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    input_box.fill(user_text)
    input_box.press("Enter")

    current_url = page.url
    expect(
        page.get_by_test_id("message-list").get_by_text(user_text, exact=True)
    ).to_be_visible()
    expect(page.get_by_text(AI_REPLY_SUBSTRING)).to_be_visible()

    page.reload()
    expect(
        page.get_by_test_id("message-list").get_by_text(user_text, exact=True)
    ).to_be_visible()
    expect(page.get_by_text(AI_REPLY_SUBSTRING)).to_be_visible()
    expect(page).to_have_url(current_url)


def test_user_namespace_isolation(page: Page):
    """
    [用例ID]: TC_CHAT_005
    [用例名称]: 同浏览器不同用户命名空间隔离历史会话
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 使用 userId=uA 发送消息
        2. 切换到 userId=uB 验证消息不存在
        3. 切回 userId=uA 验证消息恢复可见
    [预期结果]: 用户间历史会话互不可见
    """
    page.goto(f"{BASE_URL}?userId=uA")

    private_text = "uA-private-message"
    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    input_box.fill(private_text)
    input_box.press("Enter")
    expect(
        page.get_by_test_id("message-list").get_by_text(private_text, exact=True)
    ).to_be_visible()

    page.goto(f"{BASE_URL}?userId=uB")
    expect(page.get_by_text(private_text, exact=True)).not_to_be_visible()
    expect(page.get_by_text("你好，我是 Ant Design X")).to_be_visible()

    page.goto(f"{BASE_URL}?userId=uA")
    page.get_by_text(private_text, exact=True).click()
    expect(
        page.get_by_test_id("message-list").get_by_text(private_text, exact=True)
    ).to_be_visible()
