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
