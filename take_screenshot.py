import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({"width": 1280, "height": 800})
    try:
        page.goto('http://localhost:8080')
        page.wait_for_load_state('networkidle', timeout=10000)
        page.screenshot(path='screenshot.png', full_page=True)
        print("Screenshot saved to screenshot.png")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()
