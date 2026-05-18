import subprocess
import sys
import os

with open("test_results.log", "w") as f:
    cmd = [
        r".\.venv\Scripts\python.exe",
        ".trae/skills/webapp-testing/scripts/with_server.py",
        "--server", "pnpm run dev",
        "--port", "8080",
        "--timeout", "120",
        "--",
        r".\.venv\Scripts\pytest.exe",
        "-vv",
        "-s",
        "tests/test_phase1_core_flow.py",
        "tests/test_phase1_boundary.py",
        "tests/test_phase1_cache.py",
        "tests/test_phase1_ui_ux.py"
    ]
    print("Running:", " ".join(cmd))
    result = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT)
    sys.exit(result.returncode)
