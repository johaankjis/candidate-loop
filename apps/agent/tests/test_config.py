import pytest

from candidateloop.config import AgentConfigurationError, AgentSettings


def clear_agent_environment(monkeypatch):
    for name in (
        "CANDIDATELOOP_EXECUTION_MODE",
        "CANDIDATELOOP_MODEL_PROVIDER",
        "CANDIDATELOOP_MODEL_ID",
        "AWS_REGION",
        "AWS_DEFAULT_REGION",
    ):
        monkeypatch.delenv(name, raising=False)


def test_agent_settings_default_to_deterministic_bedrock_ready_configuration(monkeypatch):
    clear_agent_environment(monkeypatch)

    settings = AgentSettings.from_env()

    assert settings.execution_mode == "deterministic_local"
    assert settings.model_provider == "bedrock"
    assert settings.reported_execution_mode == "deterministic_local"


def test_agent_settings_load_strands_bedrock_from_environment(monkeypatch):
    clear_agent_environment(monkeypatch)
    monkeypatch.setenv("CANDIDATELOOP_EXECUTION_MODE", "strands")
    monkeypatch.setenv("CANDIDATELOOP_MODEL_PROVIDER", "bedrock")
    monkeypatch.setenv("CANDIDATELOOP_MODEL_ID", "us.amazon.nova-lite-v1:0")
    monkeypatch.setenv("AWS_REGION", "us-east-1")

    settings = AgentSettings.from_env()

    assert settings.model_id == "us.amazon.nova-lite-v1:0"
    assert settings.aws_region == "us-east-1"
    assert settings.reported_execution_mode == "strands_bedrock"


@pytest.mark.parametrize(
    ("name", "value", "message"),
    [
        (
            "CANDIDATELOOP_EXECUTION_MODE",
            "automatic",
            "CANDIDATELOOP_EXECUTION_MODE",
        ),
        (
            "CANDIDATELOOP_MODEL_PROVIDER",
            "unsupported",
            "supports only 'bedrock'",
        ),
    ],
)
def test_agent_settings_reject_invalid_strands_configuration(monkeypatch, name, value, message):
    clear_agent_environment(monkeypatch)
    monkeypatch.setenv("CANDIDATELOOP_EXECUTION_MODE", "strands")
    monkeypatch.setenv("CANDIDATELOOP_MODEL_ID", "test-model")
    monkeypatch.setenv(name, value)

    with pytest.raises(AgentConfigurationError, match=message):
        AgentSettings.from_env()


def test_agent_settings_require_model_id_for_strands(monkeypatch):
    clear_agent_environment(monkeypatch)
    monkeypatch.setenv("CANDIDATELOOP_EXECUTION_MODE", "strands")

    with pytest.raises(AgentConfigurationError, match="CANDIDATELOOP_MODEL_ID"):
        AgentSettings.from_env()
