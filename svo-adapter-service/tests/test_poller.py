from __future__ import annotations

from datetime import datetime, timezone

from app import poller


def test_completed_pipeline_with_failed_child_task_is_failed():
    status, update = poller._terminal_update_set(
        "COMPLETED",
        {
            "tasks": [
                {"task_id": "step-0-format_convert", "status": "COMPLETED"},
                {"task_id": "step-2-geo_aggregate", "status": "FAILED", "last_message": "[]"},
            ]
        },
    )

    assert status == "failed"
    assert update["status"] == "failed"
    assert "step-2-geo_aggregate" in update["error_message"]


def test_completed_pipeline_without_failed_tasks_records_completed_at():
    now = datetime(2026, 8, 12, tzinfo=timezone.utc)

    status, update = poller._terminal_update_set("COMPLETED", {"tasks": []}, now=now)

    assert status == "completed"
    assert update == {"status": "completed", "completed_at": "2026-08-12T00:00:00+00:00"}


def test_completed_pipeline_with_json_error_stdout_is_failed():
    status, update = poller._terminal_update_set(
        "COMPLETED",
        {
            "tasks": [
                {
                    "task_id": "step-0-budget_extract_drain",
                    "status": "COMPLETED",
                    "stdout": '{"status":"error","message":"GEO_ACTOR_ID is required"}',
                }
            ]
        },
    )

    assert status == "failed"
    assert update["status"] == "failed"
    assert "GEO_ACTOR_ID is required" in update["error_message"]


def test_failed_pipeline_without_failed_tasks_preserves_provider_error():
    status, update = poller._terminal_update_set(
        "FAILED",
        {"status": "FAILED", "message": "Workflow submission validation error: missing execution_id"},
    )

    assert status == "failed"
    assert update["status"] == "failed"
    assert update["error_message"] == "Workflow submission validation error: missing execution_id"


def test_failed_pipeline_without_provider_error_gets_actionable_fallback():
    status, update = poller._terminal_update_set("FAILED", {"tasks": []})

    assert status == "failed"
    assert update["error_message"] == "Tapis workflow reported FAILED"
