from app.mint_sync import etl_process_to_spec_row


def test_etl_process_maps_inline_python_and_contracts():
    warnings = []
    row = etl_process_to_spec_row(
        {
            "id": "https://w3id.org/okn/i/mint/etl/normalize",
            "label": "Normalize observations",
            "version": "1.0.0",
            "runtime_kind": "tapis_function",
            "runtime_json": {
                "language": "python",
                "entrypoint": "main",
                "source": "def main(inputs): return inputs",
            },
            "contracts": [
                {"role": "input", "standard_variable_uri": "https://example.org/raw", "format": "csv"},
                {"role": "output", "standard_variable_uri": "https://example.org/normalized", "format": "csv"},
            ],
        },
        warnings,
    )

    assert not warnings
    assert row["id"].endswith("/normalize")
    assert row["method"] == "tapis_function"
    assert row["transform_type"] == "etl_process"
    assert row["parameters_schema_json"]["metadata"]["runtime"]["source"].startswith("def main")
    assert len(row["contracts"]["data"]) == 2


def test_etl_process_requires_both_contract_directions():
    warnings = []
    row = etl_process_to_spec_row(
        {"id": "etl-only-input", "runtime_json": {}, "contracts": [{"role": "input"}]},
        warnings,
    )
    assert row is None
    assert "requires input and output contracts" in warnings[0]
