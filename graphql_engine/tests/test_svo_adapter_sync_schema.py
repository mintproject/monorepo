from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "graphql_engine" / "migrations" / "1771300000017_svo_adapter_sync_schema"
METADATA = ROOT / "graphql_engine" / "metadata" / "tables.yaml"
FIELD_MAPS = ROOT / "model-catalog-api" / "src" / "hasura" / "field-maps.ts"
CUSTOM_HANDLERS = ROOT / "model-catalog-api" / "src" / "custom-handlers.ts"


def test_sync_migration_adds_the_current_adapter_contract():
    up = (MIGRATION / "up.sql").read_text()
    down = (MIGRATION / "down.sql").read_text()

    assert "public.modelcatalog_configuration" in up
    assert "tapis_app_id TEXT" in up
    assert "tapis_app_version TEXT" in up
    assert "adapter.transform_edge" in up
    assert "compatibility_json JSONB" in up
    assert "DROP COLUMN IF EXISTS compatibility_json" in down
    assert "DROP COLUMN IF EXISTS tapis_app_id" in down


def test_hasura_permissions_expose_mint_app_fields():
    metadata = METADATA.read_text()
    configuration = metadata[
        metadata.index("    name: modelcatalog_configuration\n    schema: public") :
        metadata.index("- table:\n    name: modelcatalog_dataset_specification", metadata.index("    name: modelcatalog_configuration\n    schema: public"))
    ]

    assert configuration.count("tapis_app_id") >= 2
    assert configuration.count("tapis_app_version") >= 2


def test_model_catalog_api_exposes_mint_app_fields():
    assert "tapis_app_id" in FIELD_MAPS.read_text()
    assert "tapis_app_version" in FIELD_MAPS.read_text()
    assert "tapis_app_id" in CUSTOM_HANDLERS.read_text()
    assert "tapis_app_version" in CUSTOM_HANDLERS.read_text()
