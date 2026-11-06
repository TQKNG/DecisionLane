from refundflow.config import Settings


def test_evaluation_model_defaults_to_working_foundry_judge() -> None:
    settings = Settings(_env_file=None)

    assert settings.foundry_evaluation_model == "gpt-4.1-mini"
