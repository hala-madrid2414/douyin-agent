from pathlib import Path


CHAT_LAMBDA_FILE = Path("api/lambda/chat/index.ts")


def _read_chat_lambda() -> str:
    return CHAT_LAMBDA_FILE.read_text(encoding="utf-8")


def test_phase2_qweather_trigger_contract():
    """
    [用例ID]: TC_PHASE2_QWEATHER_001
    [用例名称]: QWeather 触发链路契约存在
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 chat lambda 源码
        2. 校验天气意图识别与 qweather start 事件发送逻辑
    [预期结果]:
        - 存在 WEATHER_HINT_PATTERNS 与 shouldUseWeatherTool
        - 存在 hasWeatherIntent 分支和 qweather start 状态上报
    """
    source = _read_chat_lambda()
    assert "const WEATHER_HINT_PATTERNS" in source
    assert "const shouldUseWeatherTool" in source
    assert "const hasWeatherIntent = shouldUseWeatherTool(query);" in source
    assert "if (hasWeatherIntent) {" in source
    assert "emitToolStatus('qweather', 'start'" in source


def test_phase2_qweather_degrade_contract():
    """
    [用例ID]: TC_PHASE2_QWEATHER_002
    [用例名称]: QWeather 失败降级契约存在
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 chat lambda 源码
        2. 校验 qweather error 状态上报与降级指令拼接
        3. 校验天气失败后会触发联网补偿检索
    [预期结果]:
        - 存在 qweather error 状态上报文案
        - 存在 hasWeatherIntent && weatherFailed 的补偿触发逻辑
        - 存在“暂时无法获取完整实时信息，为你提供基础建议”降级提示
    """
    source = _read_chat_lambda()
    assert "emitToolStatus(" in source
    assert "'qweather'" in source
    assert "'error'" in source
    assert "天气工具调用失败，已切换为基础建议模式" in source
    assert "(hasWeatherIntent && weatherFailed)" in source
    assert "暂时无法获取完整实时信息，为你提供基础建议" in source


def test_phase2_qweather_response_parse_guard_contract():
    """
    [用例ID]: TC_PHASE2_QWEATHER_003
    [用例名称]: QWeather 响应解析守卫契约存在
    [优先级]: High
    [前置条件]: 代码可读
    [测试步骤]:
        1. 读取 chat lambda 源码
        2. 校验 response.ok、空体、非 JSON 的受控错误分支存在
        3. 校验 JSON.parse 在 response.ok 校验之后执行
    [预期结果]:
        - 存在 qweather_empty_body / qweather_non_json_body / qweather_invalid_json 受控错误码
        - 存在 !response.ok 的前置校验
        - JSON.parse 的位置晚于 !response.ok 校验
    """
    source = _read_chat_lambda()
    assert "if (!response.ok) {" in source
    assert "throw new Error('qweather_empty_body');" in source
    assert "throw new Error('qweather_non_json_body');" in source
    assert "throw new Error('qweather_invalid_json');" in source

    ok_check_index = source.index("if (!response.ok) {")
    parse_index = source.index("JSON.parse(bodyText)")
    assert ok_check_index < parse_index
