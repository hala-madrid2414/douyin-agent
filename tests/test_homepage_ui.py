import pytest
from playwright.sync_api import Page, expect
import os

BASE_URL = os.getenv("BASE_URL", "http://localhost:8080")

def test_homepage_ui_elements(page: Page):
    """
    [用例ID]: TC_HOME_001
    [用例名称]: 验证独立式 AI 应用首页界面的核心元素展示
    [优先级]: High
    [前置条件]: 1. 本地服务已启动
    [测试步骤]: 
        1. 访问首页
        2. 验证左侧边栏 (Sidebar) 元素：Logo、新对话按钮、历史记录。
        3. 验证主欢迎区域 (WelcomeView) 元素：AI头像、欢迎语、热门话题、设计指南。
        4. 验证底部输入区域 (InputArea) 元素：快捷提示词、输入框、发送按钮。
    [预期结果]: 所有核心 UI 组件均按预期正确渲染并可见。
    """
    # 1. 访问首页
    page.goto(BASE_URL)
    
    # 2. 验证左侧边栏 (Sidebar)
    # 验证新对话按钮
    expect(page.get_by_role("button", name="新对话")).to_be_visible()
    # 验证历史记录分组 (例如 "今天", "昨天")
    expect(page.get_by_text("今天")).to_be_visible()
    expect(page.get_by_text("昨天")).to_be_visible()

    # 3. 验证主欢迎区域 (WelcomeView)
    # 验证标题
    expect(page.get_by_text("你好，我是 Ant Design X")).to_be_visible()
    # 验证副标题
    expect(page.get_by_text("基于蚂蚁设计，AGI 产品界面解决方案，打造更好的智能视觉~~")).to_be_visible()
    # 验证热门话题
    expect(page.get_by_text("热门话题")).to_be_visible()
    # 验证设计指南
    expect(page.get_by_text("设计指南")).to_be_visible()

    # 4. 验证底部输入区域 (InputArea)
    # 验证快捷提示词
    expect(page.get_by_text("升级", exact=True)).to_be_visible()
    expect(page.get_by_text("组件", exact=True)).to_be_visible()
    expect(page.get_by_text("RICH 指南", exact=True)).to_be_visible()
    expect(page.get_by_text("安装介绍", exact=True)).to_be_visible()
    # 验证输入框 (由于使用的是 Ant Design X 的 Sender，它包含 textarea)
    expect(page.get_by_placeholder("提问或输入 / 使用技能")).to_be_visible()
    # 验证发送按钮
    expect(page.get_by_role("button").filter(has=page.locator(".anticon-arrow-up"))).to_be_visible()
