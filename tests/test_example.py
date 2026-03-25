from playwright.sync_api import sync_playwright

def test_local_app_loading():
    """
    Example test case to verify local application loading state.
    This test assumes the application is running (e.g., via with_server.py) on localhost:8080.
    """
    with sync_playwright() as p:
        # Launch browser in headless mode
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            # Navigate to the local application
            # If your app runs on a different port, update the URL accordingly.
            response = page.goto('http://localhost:8080')
            
            # Wait for the network to be idle to ensure dynamic content is loaded
            page.wait_for_load_state('networkidle')
            
            # Basic assertions
            assert response is not None, "Failed to get a response from the server"
            assert response.status in [200, 304], f"Unexpected status code: {response.status}"
            
            print("Successfully verified local application loading state.")
            
            # Example of saving a screenshot to the reports directory
            import os
            import pathlib
            report_dir = os.path.join(os.path.dirname(__file__), 'reports')
            pathlib.Path(report_dir).mkdir(exist_ok=True)
            page.screenshot(path=os.path.join(report_dir, 'success_screenshot.png'))
            
        finally:
            browser.close()

if __name__ == "__main__":
    test_local_app_loading()
