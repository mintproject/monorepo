import json
import io
import urllib.request
import urllib.error

import pytest

from app.tapis import generate_tapis_workflow


def _model_code() -> str:
    workflow = generate_tapis_workflow({
        "id": "diagnostic-plan",
        "plan_json": {
            "steps": [],
            "model_task": {
                "stage_id": "model",
                "output_name": "cbb",
                "output_format": "cbc",
                "max_minutes": 1,
                "job_definition": {
                    "name": "mint-workflow-model-test",
                    "appId": "model-app",
                    "appVersion": "0.0.test",
                    "archiveSystemId": "ls6",
                },
            },
        },
    })
    return workflow["tasks"][0]["code"]


class _Response:
    def __init__(self, payload, status=200):
        self.payload = payload
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def getcode(self):
        return self.status

    def read(self):
        return json.dumps(self.payload).encode()


def _run(code, monkeypatch, capsys, responder):
    monkeypatch.setenv("TAPIS_TOKEN", "diagnostic-token")
    monkeypatch.setenv("TAPIS_BASE_URL", "https://portals.example")

    def urlopen(request, timeout=90):
        return responder(request, timeout)

    monkeypatch.setattr(urllib.request, "urlopen", urlopen)
    exec(compile(code, "model-execution", "exec"), {})
    return json.loads(capsys.readouterr().out.strip())


def test_model_stage_captures_exact_job_uuid_and_discovers_declared_output(
    monkeypatch, capsys
):
    def responder(request, _timeout):
        assert request.headers["X-tapis-token"] == "diagnostic-token"
        if request.full_url.endswith("/v3/jobs/submit"):
            return _Response({"result": {"uuid": "provider-job-1"}})
        if request.full_url.endswith("/v3/jobs/provider-job-1/status"):
            return _Response({"result": {"status": "FINISHED"}})
        if request.full_url.endswith("/v3/jobs/provider-job-1"):
            return _Response({"result": {"uuid": "provider-job-1", "archiveSystemId": "ls6"}})
        if request.full_url.endswith("/v3/jobs/provider-job-1/output/list/"):
            return _Response({"result": [{
                "type": "file",
                "name": "model.cbb",
                "path": "/scratch/model-job/model.cbb",
            }]})
        raise AssertionError(request.full_url)

    result = _run(_model_code(), monkeypatch, capsys, responder)

    assert result["status"] == "ok"
    assert result["resource_uri"] == "tapis://ls6/scratch/model-job/model.cbb"
    assert result["model_job_uuid"] == "provider-job-1"
    assert "diagnostic-token" not in json.dumps(result)


def test_model_stage_fails_closed_when_declared_output_is_ambiguous(monkeypatch, capsys):
    def responder(request, _timeout):
        if request.full_url.endswith("/v3/jobs/submit"):
            return _Response({"result": {"uuid": "provider-job-2"}})
        if request.full_url.endswith("/status"):
            return _Response({"result": {"status": "COMPLETED"}})
        if request.full_url.endswith("/v3/jobs/provider-job-2"):
            return _Response({"result": {"archiveSystemId": "ls6"}})
        if request.full_url.endswith("/output/list/"):
            return _Response({"result": [
                {"type": "file", "name": "a.cbb", "path": "/a.cbb"},
                {"type": "file", "name": "b.cbb", "path": "/b.cbb"},
            ]})
        raise AssertionError(request.full_url)

    with pytest.raises(RuntimeError, match="MODEL_OUTPUT_AMBIGUOUS"):
        _run(_model_code(), monkeypatch, capsys, responder)

    payload = json.loads(capsys.readouterr().out.strip())
    assert payload["code"] == "MODEL_OUTPUT_AMBIGUOUS"
    assert all("diagnostic-token" not in json.dumps(attempt) for attempt in payload["attempts"])


def test_model_stage_stops_on_tapis_normal_completion(monkeypatch, capsys):
    def responder(request, _timeout):
        assert request.headers["X-tapis-token"] == "diagnostic-token"
        if request.full_url.endswith("/v3/jobs/submit"):
            return _Response({"result": {"uuid": "provider-job-normal"}})
        if request.full_url.endswith("/v3/jobs/provider-job-normal/status"):
            return _Response({"result": {"status": "NORMAL_COMPLETION"}})
        if request.full_url.endswith("/v3/jobs/provider-job-normal"):
            return _Response({"result": {"uuid": "provider-job-normal", "archiveSystemId": "ls6"}})
        if request.full_url.endswith("/v3/jobs/provider-job-normal/output/list/"):
            return _Response({"result": [{
                "type": "file",
                "name": "model.cbb",
                "path": "/scratch/model-job/model.cbb",
            }]})
        raise AssertionError(request.full_url)

    result = _run(_model_code(), monkeypatch, capsys, responder)

    assert result["status"] == "ok"
    assert result["model_job_uuid"] == "provider-job-normal"


def test_model_stage_reports_auth_failure_without_echoing_the_token(monkeypatch, capsys):
    secret = "diagnostic-token"

    def responder(request, _timeout):
        assert request.headers["X-tapis-token"] == secret
        if request.full_url.endswith("/v3/jobs/submit"):
            return _Response({"result": {"uuid": "provider-job-auth"}})
        raise urllib.error.HTTPError(
            request.full_url,
            401,
            "unauthorized",
            hdrs=None,
            fp=io.BytesIO(b'{"message":"owner mismatch"}'),
        )

    with pytest.raises(RuntimeError, match="MODEL_PROVIDER_AUTH_FAILED"):
        _run(_model_code(), monkeypatch, capsys, responder)

    output = capsys.readouterr().out
    assert "MODEL_PROVIDER_AUTH_FAILED" in output
    assert secret not in output
