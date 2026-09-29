from types import SimpleNamespace

from app import tapis


def test_get_output_uri_uses_archived_stdout_for_hosted_function_task(monkeypatch):
    task = SimpleNamespace(
        task_id="step-0-budget_extract_drain",
        stdout='{"status":"ok","result":{"value":42.0,"unit":"cfs"}}',
        last_message=None,
        data={},
    )

    class Workflows:
        def listTaskExecutions(self, **kwargs):
            assert kwargs["pipeline_id"] == "pipeline-1"
            assert kwargs["pipeline_run_uuid"] == "run-1"
            return [task]

    monkeypatch.setattr(tapis, "_make_client", lambda token: SimpleNamespace(workflows=Workflows()))
    monkeypatch.setattr(tapis.settings, "tapis_exec_system", "ls6")

    assert tapis.get_output_uri("pipeline-1", "run-1", token="token") == (
        "tapis://ls6/workflows/archive/run-1/"
        "step-0-budget_extract_drain/output/.stdout"
    )


def test_get_output_uri_prefers_final_scalar_over_model_handoff_uri(monkeypatch):
    handoff = SimpleNamespace(
        task_id="output-handoff",
        stdout='{"resource_uri":"tapis://ls6/model-output/cbc-output","model_output_key":"cbc-output"}',
        last_message=None,
        data={},
    )
    final = SimpleNamespace(
        task_id="step-1-unit_convert",
        stdout='{"schema_version":1,"status":"ok","operation":"unit_convert","result":{"value":49.7,"unit":"cfs"}}',
        last_message=None,
        data={},
    )

    class Workflows:
        def listTaskExecutions(self, **kwargs):
            return [handoff, final]

    monkeypatch.setattr(tapis, "_make_client", lambda token: SimpleNamespace(workflows=Workflows()))
    monkeypatch.setattr(tapis.settings, "tapis_exec_system", "ls6")

    assert tapis.get_output_uri("pipeline-1", "run-1", token="token") == (
        "tapis://ls6/workflows/archive/run-1/"
        "step-1-unit_convert/output/.stdout"
    )
