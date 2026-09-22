from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
METADATA = ROOT / "graphql_engine" / "metadata" / "tables.yaml"
MIGRATION = (
    ROOT
    / "graphql_engine"
    / "migrations"
    / "1771300000013_normalize_hydraulic_head_inference"
)


def test_hydraulic_head_migration_canonicalizes_existing_modflow_2005_links():
    up = (MIGRATION / "up.sql").read_text()

    assert "wmobley-standard-variable-groundwater-hydraulic-head" in up
    assert "wmobley-modflow-2005-hydraulic-head" in up
    assert "UPDATE public.modelcatalog_variable_presentation" in up


def test_public_inference_relationships_are_readable_anonymously():
    metadata = METADATA.read_text()

    etl_contract = metadata[
        metadata.index("    name: modelcatalog_etl_process_contract") :
        metadata.index("- table:\n    name: data_object", metadata.index("    name: modelcatalog_etl_process_contract"))
    ]
    transform_spec = metadata[
        metadata.index("    name: transform_spec\n    schema: adapter") :
        metadata.index("- table:\n    name: transform_contract", metadata.index("    name: transform_spec\n    schema: adapter"))
    ]
    transform_contract = metadata[
        metadata.index("    name: transform_contract\n    schema: adapter") :
        metadata.index("- table:\n    name: transform_edge", metadata.index("    name: transform_contract\n    schema: adapter"))
    ]

    assert "role: anonymous" in etl_contract
    assert "visibility:" in etl_contract
    assert "role: anonymous" in transform_spec
    assert "role: anonymous" in transform_contract
    assert "columns: [transform_spec_id, role, standard_variable_uri, format]" in transform_contract
