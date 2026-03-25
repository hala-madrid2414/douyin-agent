# WebApp Testing Conventions

本文档定义了本项目基于 Playwright 的前端及全栈 WebApp 自动化测试规范。本规范兼顾开发者手动编写与 AI/Agent 自动生成，所有测试代码必须严格遵循此规范，以确保工程的高效、稳定与可维护。

---

## 1. 项目结构与环境隔离规范

**核心原则：代码目录与环境目录、产物目录必须物理隔离。**

### 1.1 完整标准目录示例
```text
项目根目录/
  ├── .venv/                      # (Git忽略) Python 虚拟环境，仅存放解释器和依赖库
  ├── reports/                    # (Git忽略) 测试产物目录，存放截图、视频、日志、测试报告
  ├── tests/                      # (Git提交) 测试代码目录
  │   ├── requirements.txt        # 测试专属依赖清单
  │   ├── conftest.py             # pytest 全局配置与夹具 (Fixtures)
  │   └── test_feature_name.py    # 具体的测试脚本
  ├── src/                        # 业务源码
  └── docs/                       # 文档目录
```

### 1.2 目录与文件职责
- **`.venv/` 虚拟环境**：**绝对不存储任何测试代码或业务代码**。它仅用于存放 Python 解释器及安装的第三方依赖包。厘清环境与代码的本质区别，避免污染。
- **`tests/` 代码目录**：所有的测试脚本、用例以及辅助测试的 Python 脚本，**必须** 放置在项目根目录的 `tests/` 目录下。该目录随代码库提交。
- **`reports/` 产物目录**：独立于代码目录，用于存放运行过程中产生的临时文件和结果产物（不随 Git 提交）。

### 1.3 Git 忽略清单
确保项目根目录的 `.gitignore` 中包含以下与测试相关的忽略项：
```gitignore
# Python & Testing
.venv/
reports/
__pycache__/
*.py[cod]
.pytest_cache/
```

---

## 2. 依赖管理与执行规范

### 2.1 依赖管理
测试环境的依赖应与业务代码依赖解耦。统一使用 `tests/requirements.txt` 管理测试依赖。
- **安装依赖**：`pip install -r tests/requirements.txt`
- **更新/冻结依赖**：`pip freeze > tests/requirements.txt`

### 2.2 跨平台执行路径
废除硬编码特定操作系统的解释器路径。统一采用**先激活环境，后执行命令**的标准跨平台做法：
1. **激活虚拟环境**：
   - **Windows**: `.\.venv\Scripts\activate`
   - **Mac/Linux**: `source .venv/bin/activate`
2. **执行测试**：直接使用 `pytest tests/` 或 `python tests/test_xxx.py`。

---

## 3. 命名规范

为适配 AI/Agent 自动生成规范代码，需严格遵循以下命名规则：
- **测试文件**：使用 `test_` 开头，采用下划线命名法，如 `test_user_login.py`。
- **测试函数**：使用 `test_` 开头，格式为 `test_<功能>_<场景>`，如 `test_login_with_invalid_password`。
- **元素定位器（变量名）**：使用描述性强、语义化的命名，禁止使用无意义的缩写，如 `submit_button`、`error_message_label`。

---

## 4. 测试用例编写规范 (面向开发者与 AI/Agent)

### 4.1 用例标准结构
强制要求每个测试函数必须包含标准的 Docstring 注释模板，明确用例的元数据。该模板可直接复用：

```python
def test_user_login_success():
    """
    [用例ID]: TC_AUTH_001
    [用例名称]: 用户使用正确的凭证成功登录
    [优先级]: High
    [前置条件]: 1. 本地服务已启动 2. 存在有效的测试用户账号
    [测试步骤]: 
        1. 访问登录页面
        2. 输入正确的用户名和密码
        3. 点击登录按钮
    [预期结果]: 页面重定向至首页，并显示用户头像。
    """
    # 测试代码实现...
```

### 4.2 用例分层规则
明确划分测试层级，指导 AI/Agent 或开发者精准生成覆盖全面的用例：
1. **冒烟测试 (Smoke)**：验证系统核心链路（如登录、核心主业务流）是否畅通，确保应用基本可用。
2. **功能测试 (Feature)**：验证各功能模块的业务逻辑是否符合需求预期。
3. **边界测试 (Boundary)**：验证极限输入、超长字符、空数据、极值等边界条件下的表现。
4. **异常测试 (Exception)**：验证错误输入、网络异常、权限不足等异常场景时的系统容错与提示表现。

### 4.3 AI/Agent 编写约束
- **单一职责**：单用例仅测单一核心功能，**禁止冗余复杂的巨型用例**。
- **无硬编码**：测试数据、环境 URL 等应提取为常量或通过配置文件传入。
- **步骤可复现**：确保每一步操作具有确定性，不依赖随机状态或不可控的外部依赖。

---

## 5. 断言与验收规范

### 5.1 核心验证维度
- **功能校验**：交互后业务逻辑是否正确流转（如：表单提交后数据是否增加）。
- **UI 校验**：核心元素是否按预期显示、隐藏或改变状态。
- **状态校验**：系统内部状态（如 Cookie、LocalStorage、网络响应状态码）是否正确。
- **异常校验**：错误提示文案是否精准触达，异常行为是否被正确拦截。

### 5.2 断言最佳实践
**强制使用 Playwright 提供的 `expect` API** 进行自动重试断言，**严禁使用低效且不稳定的原生 `assert`** 进行 UI 状态校验。

❌ **反面模式 (脆弱的原生 assert)**：
```python
# 容易因为页面渲染延迟导致断言失败，引发 Flaky Test
assert page.locator(".success-msg").is_visible()
```

✅ **最佳实践 (稳定的 expect 断言)**：
```python
from playwright.sync_api import expect

# expect 具备内置的自动等待机制（默认重试直至超时）
expect(page.locator(".success-msg")).to_be_visible()
expect(page.get_by_role("heading")).to_have_text("Welcome")
```

### 5.3 结果判定规则
适配 AI/Agent 自动解析测试结果：
- **通过 (Pass)**：所有 `expect` 断言成功，且未抛出任何未捕获异常。
- **失败 (Fail)**：断言失败，或执行过程中产生业务侧抛出的前端异常/控制台错误。
- **跳过 (Skip)**：因环境不满足条件被标记为跳过（如：跳过某些仅在线上执行的用例）。
- **阻塞 (Block)**：因前置依赖或基础服务故障（如登录服务挂掉），导致当前用例无法执行。

---

## 6. 最佳实践 (适配 AI/Agent 协作)

### 6.1 废除 `networkidle` 等待反模式
**摒弃“必须等待 `networkidle`”的规则**。在现代动态 WebApp 中，网络请求往往是持续不断的，依赖 `page.wait_for_load_state('networkidle')` 会导致测试极易随机超时或卡死。
- **适用场景**：`networkidle` **仅**在测试纯静态页面时允许使用。
- **替代方案（推荐）**：依赖 Playwright 的**动作自动等待（Auto-waiting）**特性，或使用 `expect` 显式等待特定元素出现。
  ```python
  # 直接操作，Playwright 会自动等待该元素可被点击
  page.get_by_role("button", name="Submit").click()
  
  # 断言特定内容加载完成（自动重试等待）
  expect(page.locator(".data-table")).to_be_visible()
  ```

### 6.2 元素定位最佳实践
优先使用面向用户的定位器（User-facing locators），规避脆弱的 DOM 结构选择器：
- **首选**：`page.get_by_role()`, `page.get_by_text()`, `page.get_by_label()`, `page.get_by_test_id()`。
- **避免**：依赖 DOM 结构的深层 CSS 或 XPath 选择器（如 `#app > div > div:nth-child(2) > span`）。

### 6.3 浏览器实例生命周期管理
强制使用 `with` 语法管理 `sync_playwright` 和浏览器实例，确保无论测试成功与否，资源都能被正确释放，**杜绝资源泄漏和僵尸进程**。

### 6.4 测试日志与截图留存规则
所有的产物必须输出至项目根目录的 `reports/` 文件夹下。
- **报错必截**：在异常捕获或 fixture teardown 中，针对失败的用例自动截图/保存 Trace 以供排查。
- **关键步骤可选截**：对于关键业务流的成功状态，可调用 `page.screenshot(path="reports/step_name.png")` 留存。

### 6.5 本地服务启动与测试解耦规范
测试脚本本身**不应**包含启动业务服务器的硬编码逻辑。必须使用外部工具（如项目提供的 `with_server.py`）管理服务生命周期。

针对本项目的 Modern.js + pnpm + Rspack 架构，推荐如下配置：
- **包管理器**: `pnpm`
- **构建工具**: `Rspack`
- **框架**: `Modern.js`
- **默认启动命令**: `pnpm run dev`
- **默认端口**: `8080` (Modern.js 默认)

```bash
# 示例：通过辅助脚本启动开发服务器后运行 pytest (适配 Modern.js)
python .trae/skills/webapp-testing/scripts/with_server.py --server "pnpm run dev" --port 8080 -- pytest tests/
```

### 6.6 AI 生成测试代码的校验准则
AI/Agent 生成代码后，需进行自我 review：
1. **可读性**：是否包含标准的 Docstring 用例模板和必要的行内注释？
2. **稳定性**：是否强制使用了 `expect` 替代原生 `assert`？是否彻底避免了 `time.sleep()` 和滥用 `networkidle`？
3. **可维护性**：选择器是否健壮（首选 role/text）？测试数据是否解耦？