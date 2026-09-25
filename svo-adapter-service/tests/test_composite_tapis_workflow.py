from app.tapis import generate_tapis_workflow


def test_composite_workflow_contains_model_handoff_and_adapter_tasks():
    workflow = generate_tapis_workflow({
        "id": "deferred-plan-1",
        "plan_json": {
            "steps": [{
                "step": 0,
                "name": "cbc-to-spring-flow",
                "transform_type": "cbc-to-spring-flow",
                "tapis_app_id": "svo-cbc-adapter",
                "app_version": "0.0.1",
                "file_inputs": [{
                    "name": "model-output",
                    "from_arg": "source_uri",
                    "target_path": "input/model-output.cbc",
                }],
            }],
            "parameters": [{"name": "source_uri", "required": True}],
            "model_task": {
                "stage_id": "model",
                "output_uri": "tapis://ls6/mint-workflow-output/ue-1/model/cbc-output",
                "output_name": "cbc-output",
                "job_definition": {
                    "appId": "modflow6-simulation",
                    "appVersion": "0.0.test",
                    "archiveSystemId": "ls6",
                    "fileInputs": [],
                    "parameterSet": {"appArgs": []},
                },
            },
        },
    })

    assert [task["id"] for task in workflow["tasks"]] == [
        "model",
        "output-handoff",
        "step-0-cbc-to-spring-flow",
    ]
    assert workflow["tasks"][1]["depends_on"] == [{"id": "model"}]
    assert workflow["tasks"][2]["depends_on"] == [{"id": "output-handoff"}]
    assert workflow["tasks"][0]["type"] == "tapis_job"
    assert workflow["tasks"][2]["tapis_job_def"]["appId"] == "svo-cbc-adapter"
    assert workflow["tasks"][0]["tapis_job_def"]["execSystemInputDir"] == "${JobWorkingDir}"
    assert workflow["tasks"][0]["tapis_job_def"]["execSystemOutputDir"] == "${JobWorkingDir}/output"
    assert workflow["params"]["start_date"]["required"] is False
    assert workflow["params"]["end_date"]["required"] is False
    assert workflow["params"]["aoi_geojson_uri"]["required"] is False
    assert "Bearer " not in str(workflow)
    assert "super-secret-token" not in str(workflow)
