import os
import re

import pytest


def _safe_filename(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", name)


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()

    if report.when != "call" or not report.failed:
        return

    page = item.funcargs.get("page")
    if not page:
        return

    os.makedirs("reports", exist_ok=True)
    screenshot_path = os.path.join("reports", f"{_safe_filename(item.name)}.png")
    page.screenshot(path=screenshot_path, full_page=True)
