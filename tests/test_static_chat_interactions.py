from playwright.sync_api import Page, expect


BASE_URL = "http://localhost:8080"
AI_REPLY_SUBSTRING = "前端 Mock 固定回复"


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
    expect(page.get_by_text(user_text, exact=True)).to_be_visible()
    expect(page.get_by_text(AI_REPLY_SUBSTRING)).to_be_visible()


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

    page.get_by_role("button", name="新对话").click()
    expect(page.get_by_text("你好，我是 Ant Design X")).to_be_visible()
    expect(page.get_by_test_id("message-list")).not_to_be_visible()
