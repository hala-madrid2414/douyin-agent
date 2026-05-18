import os
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # 记录控制台日志和网络请求
    page.on("console", lambda msg: print(f"Browser Console [{msg.type}]: {msg.text}"))
    page.on("request", lambda req: print(f"Network Request: {req.method} {req.url}"))
    page.on("response", lambda res: print(f"Network Response: {res.status} {res.url}"))

    print("Navigating to http://localhost:8080/")
    page.goto('http://localhost:8080/')
    page.wait_for_load_state('networkidle')
    
    # 截图看看当前页面状态
    page.screenshot(path='screenshot_before.png', full_page=True)
    print("Screenshot saved to screenshot_before.png")

    # 尝试找到输入框并发送消息
    print("Looking for chat input...")
    input_locator = page.locator("textarea, input[type='text']").first
    if input_locator.count() > 0:
        input_locator.fill("去北京玩3天")
        page.keyboard.press("Enter")
        print("Message sent, waiting for response...")
        page.wait_for_timeout(5000) # 等待 API 返回
        page.screenshot(path='screenshot_after.png', full_page=True)
        print("Screenshot saved to screenshot_after.png")
    else:
        print("Input box not found.")

    browser.close()
