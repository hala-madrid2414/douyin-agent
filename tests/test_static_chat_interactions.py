import json
import os
import re
import time
from pathlib import Path
from playwright.sync_api import Page, expect


BASE_URL = os.getenv("BASE_URL", "http://localhost:8080")
AI_REPLY_SUBSTRING = "前端 Mock 固定回复"
CHAT_ROUTE_PATTERN = re.compile(r".*/chat/\d{17}$")
CHAT_STORAGE_KEY = "chat-store"
CHAT_CACHE_SCHEMA_VERSION = 1
CHAT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7
INVALID_CHAT_ROUTE_PATTERN = re.compile(r".*/chat/[^/]+$")
CHAT_CONSTANTS_PATH = Path(__file__).resolve().parents[1] / "src" / "constants" / "chat.ts"


def _get_chat_store_state(page: Page) -> dict:
    return page.evaluate(
        """(key) => {
            const raw = window.localStorage.getItem(key);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed?.state ?? {};
        }""",
        CHAT_STORAGE_KEY,
    )


def _set_chat_store(page: Page, payload: dict) -> None:
    payload_json = json.dumps(payload, ensure_ascii=False)
    key_json = json.dumps(CHAT_STORAGE_KEY)
    user_id = (
        payload.get("state", {}).get("activeUserId")
        if isinstance(payload, dict)
        else None
    )
    user_id_json = json.dumps(user_id, ensure_ascii=False)
    page.add_init_script(
        f"""(() => {{
            window.localStorage.setItem({key_json}, JSON.stringify({payload_json}));
            if ({user_id_json}) {{
                window.localStorage.setItem('chat:userId', {user_id_json});
            }}
        }})()""",
    )


def _read_mock_session_titles_from_constants() -> list[str]:
    content = CHAT_CONSTANTS_PATH.read_text(encoding="utf-8")
    block_match = re.search(
        r"export const MOCK_CHAT_SESSIONS: ChatSession\[\] = \[(.*?)\n\];",
        content,
        re.S,
    )
    if not block_match:
        return []
    block = block_match.group(1)
    return re.findall(r"title:\s*'([^']+)'", block)


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

    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()
    page.get_by_text("川西自驾线路规划", exact=True).click()

    expect(page.get_by_text("你好，我是你的旅行搭子")).not_to_be_visible()
    expect(page.get_by_test_id("message-list")).to_be_visible()
    expect(page.get_by_text("我想去川西自驾，大概5天时间，有什么推荐的路线吗？")).to_be_visible()
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

    expect(page.get_by_text("你好，我是你的旅行搭子")).not_to_be_visible()
    expect(page.get_by_test_id("message-list")).to_be_visible()
    expect(
        page.get_by_test_id("message-list").get_by_text(user_text, exact=True)
    ).to_be_visible()
    expect(page.get_by_text(AI_REPLY_SUBSTRING)).to_be_visible()
    expect(page).to_have_url(CHAT_ROUTE_PATTERN)


def test_new_chat_clears_messages_and_shows_welcome(page: Page):
    """
    [用例ID]: TC_CHAT_003
    [用例名称]: 新对话进入空会话后再次点击会提示并跳过创建
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 访问首页并进入任一历史会话
        2. 点击“新对话”
        3. 再次点击“新对话”
        4. 验证弹窗提示出现、路由与会话数量保持不变
    [预期结果]: 新对话回到欢迎态；已在新会话时不会重复创建会话
    """
    page.goto(BASE_URL)

    page.get_by_text("React 基础教程", exact=True).click()
    expect(page.get_by_test_id("message-list")).to_be_visible()
    expect(page).to_have_url(CHAT_ROUTE_PATTERN)

    page.locator("button.new-chat-btn").click()
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()
    expect(page.get_by_test_id("message-list")).not_to_be_visible()
    expect(page).to_have_url(CHAT_ROUTE_PATTERN)
    first_new_chat_url = page.url
    first_state = _get_chat_store_state(page)
    first_active_user = first_state.get("activeUserId", "mock-user")
    first_conversation_total = len(
        first_state.get("byUser", {})
        .get(first_active_user, {})
        .get("conversationsById", {})
    )

    page.locator("button.new-chat-btn").click()
    expect(
        page.locator(".ant-modal-confirm-title", has_text="已在新对话中")
    ).to_be_visible()
    expect(
        page.locator(
            ".ant-modal-confirm-content",
            has_text="当前已经是新对话，无需重复创建。",
        )
    ).to_be_visible()
    page.get_by_role("button", name="知道了").click()
    expect(page).to_have_url(first_new_chat_url)

    second_state = _get_chat_store_state(page)
    second_active_user = second_state.get("activeUserId", "mock-user")
    second_conversation_total = len(
        second_state.get("byUser", {})
        .get(second_active_user, {})
        .get("conversationsById", {})
    )
    assert second_conversation_total == first_conversation_total


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
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()

    page.goto(f"{BASE_URL}?userId=uA")
    page.get_by_text(private_text, exact=True).first.click()
    expect(page.get_by_test_id("message-list")).to_be_visible()
    expect(
        page.get_by_test_id("message-list").get_by_text(private_text, exact=True)
    ).to_be_visible()


def test_send_message_updates_conversation_summary_and_timestamp(page: Page):
    """
    [用例ID]: TC_CHAT_006
    [用例名称]: 发送后会话摘要字段与更新时间正确更新
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 访问首页并点击“新对话”
        2. 记录会话发送前摘要时间戳
        3. 发送用户消息后校验会话摘要与时间戳
    [预期结果]: messageCount/preview/title 与 updatedAt 均按发送结果更新
    """
    page.goto(BASE_URL)

    page.locator("button.new-chat-btn").click()
    expect(page).to_have_url(CHAT_ROUTE_PATTERN)
    conversation_url = page.url
    conversation_id = conversation_url.rstrip("/").split("/")[-1]

    before_store = _get_chat_store_state(page)
    before_active_user = before_store.get("activeUserId", "mock-user")
    before_conversation = (
        before_store.get("byUser", {})
        .get(before_active_user, {})
        .get("conversationsById", {})
        .get(conversation_id, {})
    )
    before_updated_at = before_conversation.get("updatedAt")
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()

    user_text = "摘要时间戳更新校验"
    input_box = page.get_by_placeholder("提问或输入 / 使用技能")
    input_box.fill(user_text)
    input_box.press("Enter")

    expect(page.get_by_test_id("message-list")).to_be_visible()
    expect(
        page.get_by_test_id("message-list").get_by_text(user_text, exact=True)
    ).to_be_visible()
    expect(page.get_by_text(AI_REPLY_SUBSTRING)).to_be_visible()

    after_store = _get_chat_store_state(page)
    after_active_user = after_store.get("activeUserId", "mock-user")
    after_conversation = (
        after_store.get("byUser", {})
        .get(after_active_user, {})
        .get("conversationsById", {})
        .get(conversation_id, {})
    )

    assert after_conversation.get("messageCount") == 2
    assert user_text in after_conversation.get("title", "")
    assert AI_REPLY_SUBSTRING in after_conversation.get("lastMessagePreview", "")
    assert after_conversation.get("updatedAt", "") >= before_updated_at


def test_cache_schema_version_mismatch_invalidates_persisted_state(page: Page):
    """
    [用例ID]: TC_CHAT_007
    [用例名称]: schemaVersion 不匹配时旧缓存失效并回退初始状态
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 预写入版本不匹配的旧缓存
        2. 打开首页
        3. 校验旧缓存会话不被加载，页面回到初始可用状态
    [预期结果]: 旧缓存被丢弃，默认历史会话可见
    """
    legacy_title = "schema-legacy-session"
    now_ms = int(time.time() * 1000)
    _set_chat_store(
        page,
        {
            "state": {
                "activeUserId": "mock-user",
                "byUser": {
                    "mock-user": {
                        "conversationsById": {
                            "17000000000009999": {
                                "id": "17000000000009999",
                                "title": legacy_title,
                                "createdAt": "2024-01-01T00:00:00.000Z",
                                "updatedAt": "2024-01-01T00:00:00.000Z",
                                "lastMessagePreview": legacy_title,
                                "messageCount": 1,
                                "messages": [
                                    {
                                        "id": "legacy-m1",
                                        "role": "user",
                                        "content": legacy_title,
                                        "createdAt": "2024-01-01T00:00:00.000Z",
                                    }
                                ],
                            }
                        },
                        "order": ["17000000000009999"],
                        "draftByConversationId": {},
                        "persistedAt": now_ms,
                    }
                },
            },
            "version": CHAT_CACHE_SCHEMA_VERSION + 1,
        },
    )

    page.goto(BASE_URL)

    expect(page.get_by_text(legacy_title, exact=True)).not_to_be_visible()
    expect(page.get_by_text("React 基础教程", exact=True)).to_be_visible()


def test_cache_ttl_expired_invalidates_persisted_state(page: Page):
    """
    [用例ID]: TC_CHAT_008
    [用例名称]: 缓存超过 TTL 后旧会话失效
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 预写入已过期缓存
        2. 访问指定用户空间
        3. 校验旧会话未恢复且展示欢迎视图
    [预期结果]: 过期缓存被清空，不会恢复旧会话
    """
    expired_title = "ttl-expired-session"
    expired_persisted_at = 1730000000000 - CHAT_CACHE_TTL_MS - 60_000
    _set_chat_store(
        page,
        {
            "state": {
                "activeUserId": "uTTL",
                "byUser": {
                    "uTTL": {
                        "conversationsById": {
                            "17000000000008888": {
                                "id": "17000000000008888",
                                "title": expired_title,
                                "createdAt": "2024-01-01T00:00:00.000Z",
                                "updatedAt": "2024-01-01T00:00:00.000Z",
                                "lastMessagePreview": expired_title,
                                "messageCount": 1,
                                "messages": [
                                    {
                                        "id": "expired-m1",
                                        "role": "user",
                                        "content": expired_title,
                                        "createdAt": "2024-01-01T00:00:00.000Z",
                                    }
                                ],
                            }
                        },
                        "order": ["17000000000008888"],
                        "draftByConversationId": {},
                        "persistedAt": expired_persisted_at,
                    }
                },
            },
            "version": CHAT_CACHE_SCHEMA_VERSION,
        },
    )

    page.goto(f"{BASE_URL}?userId=uTTL")

    expect(page.get_by_text(expired_title, exact=True)).not_to_be_visible()
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()


def test_invalid_chat_id_redirects_to_safe_fallback(page: Page):
    """
    [用例ID]: TC_CHAT_009
    [用例名称]: 非法会话 ID 会被拦截并兜底跳转
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 访问非法会话路由
        2. 校验页面触发兜底跳转并保留查询参数
        3. 校验未进入非法会话页且展示欢迎视图
    [预期结果]: 非法路由被拦截，回到安全默认页
    """
    page.goto(f"{BASE_URL}/chat/not-a-valid-id-xyz?userId=fallback-user")

    expect(page).not_to_have_url(INVALID_CHAT_ROUTE_PATTERN)
    expect(page).to_have_url(re.compile(r".*/\?userId=fallback-user$"))
    expect(page.get_by_text("你好，我是你的旅行搭子")).to_be_visible()


def test_duplicate_order_ids_are_deduplicated_for_history_render(page: Page):
    """
    [用例ID]: TC_CHAT_010
    [用例名称]: 持久化中的重复 order ID 会被去重避免历史项重复
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 预写入包含重复会话 ID 的缓存
        2. 打开首页并检查历史项展示
        3. 校验路由切换与 store 中 order 已去重
    [预期结果]: 历史列表不出现重复项，store 的 order 仅保留唯一 ID
    """
    duplicate_user_id = "uDedupe"
    duplicate_conversation_id = "17000000000007777"
    duplicate_title = "duplicate-history-item"
    now_ms = int(time.time() * 1000)
    _set_chat_store(
        page,
        {
            "state": {
                "activeUserId": duplicate_user_id,
                "byUser": {
                    duplicate_user_id: {
                        "conversationsById": {
                            duplicate_conversation_id: {
                                "id": duplicate_conversation_id,
                                "title": duplicate_title,
                                "createdAt": "2024-01-01T00:00:00.000Z",
                                "updatedAt": "2024-01-01T00:00:00.000Z",
                                "lastMessagePreview": duplicate_title,
                                "messageCount": 1,
                                "messages": [
                                    {
                                        "id": "duplicate-m1",
                                        "role": "user",
                                        "content": duplicate_title,
                                        "createdAt": "2024-01-01T00:00:00.000Z",
                                    }
                                ],
                            }
                        },
                        "order": [
                            duplicate_conversation_id,
                            duplicate_conversation_id,
                            duplicate_conversation_id,
                        ],
                        "draftByConversationId": {},
                        "persistedAt": now_ms,
                    }
                },
            },
            "version": CHAT_CACHE_SCHEMA_VERSION,
        },
    )

    page.goto(f"{BASE_URL}?userId={duplicate_user_id}")

    expect(page.get_by_text(duplicate_title, exact=True)).to_have_count(1)
    page.get_by_text(duplicate_title, exact=True).click()
    expect(page).to_have_url(
        re.compile(rf".*/chat/17000000000007777\?userId={duplicate_user_id}$")
    )


def test_mock_user_duplicate_order_recovers_builtin_history(page: Page):
    """
    [用例ID]: TC_CHAT_011
    [用例名称]: mock-user 缓存存在重复 order 时回退内置静态历史
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 预写入 mock-user 的脏缓存（重复 order + 非内置会话）
        2. 打开首页
        3. 校验脏会话不显示，且内置静态历史正常展示
    [预期结果]: 检测到重复 order 后自动回退到内置静态历史，避免重复与脏数据污染
    """
    now_ms = int(time.time() * 1000)
    _set_chat_store(
        page,
        {
            "state": {
                "activeUserId": "mock-user",
                "byUser": {
                    "mock-user": {
                        "conversationsById": {
                            "17000000000000004": {
                                "id": "17000000000000004",
                                "title": "TypeScript 泛型解析",
                                "createdAt": "2024-01-01T00:00:00.000Z",
                                "updatedAt": "2024-01-01T00:00:00.000Z",
                                "lastMessagePreview": "TypeScript 泛型解析",
                                "messageCount": 1,
                                "messages": [],
                            },
                            "17000000000006666": {
                                "id": "17000000000006666",
                                "title": "脏数据会话",
                                "createdAt": "2024-01-02T00:00:00.000Z",
                                "updatedAt": "2024-01-02T00:00:00.000Z",
                                "lastMessagePreview": "脏数据会话",
                                "messageCount": 1,
                                "messages": [],
                            },
                        },
                        "order": [
                            "17000000000000004",
                            "17000000000000004",
                            "17000000000006666",
                        ],
                        "draftByConversationId": {},
                        "persistedAt": now_ms,
                    }
                },
            },
            "version": CHAT_CACHE_SCHEMA_VERSION,
        },
    )

    page.goto(BASE_URL)

    expect(page.get_by_text("脏数据会话", exact=True)).not_to_be_visible()
    expect(page.get_by_text("TypeScript 泛型解析", exact=True)).to_have_count(1)
    expect(page.get_by_text("React 基础教程", exact=True)).to_be_visible()
    expect(page.get_by_text("Vue Pinia 状态管理", exact=True)).to_be_visible()


def test_mock_user_missing_order_item_recovers_lost_builtin_session(page: Page):
    """
    [用例ID]: TC_CHAT_012
    [用例名称]: mock-user 缓存顺序缺口会补回丢失的内置静态会话
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 预写入 mock-user 缓存（conversationsById 含 4 条内置会话，但 order 缺少 17xxx3）
        2. 打开首页
        3. 校验“如何使用 Vite 部署”可见
    [预期结果]: 不会因为 order 缺口丢失内置静态会话
    """
    now_ms = int(time.time() * 1000)
    _set_chat_store(
        page,
        {
            "state": {
                "activeUserId": "mock-user",
                "byUser": {
                    "mock-user": {
                        "conversationsById": {
                            "17000000000000001": {
                                "id": "17000000000000001",
                                "title": "React 基础教程",
                                "createdAt": "2024-01-01T00:00:00.000Z",
                                "updatedAt": "2024-01-01T00:00:00.000Z",
                                "lastMessagePreview": "React 基础教程",
                                "messageCount": 1,
                                "messages": [],
                            },
                            "17000000000000002": {
                                "id": "17000000000000002",
                                "title": "Antd 自定义主题",
                                "createdAt": "2024-01-02T00:00:00.000Z",
                                "updatedAt": "2024-01-02T00:00:00.000Z",
                                "lastMessagePreview": "Antd 自定义主题",
                                "messageCount": 1,
                                "messages": [],
                            },
                            "17000000000000003": {
                                "id": "17000000000000003",
                                "title": "如何使用 Vite 部署",
                                "createdAt": "2024-01-03T00:00:00.000Z",
                                "updatedAt": "2024-01-03T00:00:00.000Z",
                                "lastMessagePreview": "如何使用 Vite 部署",
                                "messageCount": 1,
                                "messages": [],
                            },
                            "17000000000000004": {
                                "id": "17000000000000004",
                                "title": "TypeScript 泛型解析",
                                "createdAt": "2024-01-04T00:00:00.000Z",
                                "updatedAt": "2024-01-04T00:00:00.000Z",
                                "lastMessagePreview": "TypeScript 泛型解析",
                                "messageCount": 1,
                                "messages": [],
                            },
                        },
                        "order": [
                            "17000000000000001",
                            "17000000000000002",
                            "17000000000000004",
                        ],
                        "draftByConversationId": {},
                        "persistedAt": now_ms,
                    }
                },
            },
            "version": CHAT_CACHE_SCHEMA_VERSION,
        },
    )

    page.goto(BASE_URL)

    expect(page.get_by_text("如何使用 Vite 部署", exact=True)).to_be_visible()


def test_mock_user_stale_cache_syncs_with_current_constants_sessions(page: Page):
    """
    [用例ID]: TC_CHAT_013
    [用例名称]: mock-user 的旧缓存会与当前 constants 静态会话自动对齐
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]:
        1. 预写入旧缓存（包含已删除标题）
        2. 打开首页
        3. 校验侧边栏会话标题与 constants 的 MOCK_CHAT_SESSIONS 一致
    [预期结果]: 默认用户不会展示旧缓存标题，展示与 constants 完全一致
    """
    expected_titles = _read_mock_session_titles_from_constants()
    now_ms = int(time.time() * 1000)
    _set_chat_store(
        page,
        {
            "state": {
                "activeUserId": "mock-user",
                "byUser": {
                    "mock-user": {
                        "conversationsById": {
                            "17000000000000001": {
                                "id": "17000000000000001",
                                "title": "React 基础教程",
                                "createdAt": "2024-01-01T00:00:00.000Z",
                                "updatedAt": "2024-01-01T00:00:00.000Z",
                                "lastMessagePreview": "React 基础教程",
                                "messageCount": 1,
                                "messages": [],
                            },
                            "17000000000000002": {
                                "id": "17000000000000002",
                                "title": "Antd 自定义主题",
                                "createdAt": "2024-01-02T00:00:00.000Z",
                                "updatedAt": "2024-01-02T00:00:00.000Z",
                                "lastMessagePreview": "Antd 自定义主题",
                                "messageCount": 1,
                                "messages": [],
                            },
                        },
                        "order": ["17000000000000001", "17000000000000002"],
                        "draftByConversationId": {},
                        "persistedAt": now_ms,
                    }
                },
            },
            "version": CHAT_CACHE_SCHEMA_VERSION,
        },
    )

    page.goto(BASE_URL)
    expect(page.locator("button.new-chat-btn")).to_be_visible()

    for title in expected_titles:
        assert page.get_by_text(title, exact=True).count() >= 1
    assert page.get_by_text("Antd 自定义主题", exact=True).count() == 0
