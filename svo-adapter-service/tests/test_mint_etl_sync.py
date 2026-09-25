from app.mint_sync import _build_env_from_args, etl_process_to_spec_row


def test_spatial_mint_labels_use_canonical_args_and_preserve_two_uri_etls():
    warnings = []
    env = _build_env_from_args([
        {"parameter": {"label": "gma boundary uri"}},
        {"parameter": {"label": "dfc area boundary uri"}},
        {"parameter": {"label": "gma_id"}},
        {"parameter": {"label": "model_layer"}},
    ], "config-1", warnings)

    assert env["GEOMETRY_SOURCE_URI"] == "geometry_source_uri"
    assert env["DFC_AREA_BOUNDARY_URI"] == "dfc_area_boundary_uri"
    assert env["SPATIAL_SCOPE_ID"] == "spatial_scope_id"
    assert env["MODEL_LAYER"] == "model_layer"
    assert not warnings

    warnings = []
    reversed_env = _build_env_from_args([
        {"parameter": {"label": "dfc area boundary uri"}},
        {"parameter": {"label": "gma boundary uri"}},
    ], "config-1", warnings)
    assert reversed_env["GEOMETRY_SOURCE_URI"] == "geometry_source_uri"
    assert reversed_env["DFC_AREA_BOUNDARY_URI"] == "dfc_area_boundary_uri"
    assert not warnings


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
                {"role": "input", "position": 0, "standard_variable_uri": "https://example.org/raw", "format": "csv"},
                {"role": "output", "position": 1, "standard_variable_uri": "https://example.org/normalized", "format": "csv"},
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
    assert all("position" not in contract for contract in row["contracts"]["data"])
    assert row["contracts"]["data"][0]["metadata_json"] == {"mint_position": 0}


def test_etl_process_requires_both_contract_directions():
    warnings = []
    row = etl_process_to_spec_row(
        {"id": "etl-only-input", "runtime_json": {}, "contracts": [{"role": "input"}]},
        warnings,
    )
    assert row is None
    assert "requires input and output contracts" in warnings[0]
