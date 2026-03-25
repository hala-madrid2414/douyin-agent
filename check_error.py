import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_viewport_size({"width": 1280, "height": 800})
    
    errors = []
    page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: errors.append(str(exc)))

    try:
        page.goto('http://localhost:8080')
        page.wait_for_load_state('networkidle', timeout=10000)
        content = page.content()
        
        if "Unexpected Application Error!" in content:
            print("FOUND ERROR UI")
        else:
            print("NO ERROR UI")
            
        print("Console errors:", errors)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()
