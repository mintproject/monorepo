from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "graphql_engine" / "migrations" / "1771300000033_repair_modflow2000_output_positions"

OUTPUT_POSITIONS = {
    "https://w3id.org/okn/i/mint/6b16c7bc-25ef-4afb-bc4b-35b10cc409c9": 2,
    "https://w3id.org/okn/i/mint/9aadd1a3-cd8c-4f52-8eda-4b897e1d786f": 4,
    "https://w3id.org/okn/i/mint/d9caf5a9-335e-4883-a50b-699f387cf34a": 3,
}


def test_up_migration_repairs_each_modflow2000_output_position():
    up = " ".join((MIGRATION / "up.sql").read_text().split())

    for output_id, position in OUTPUT_POSITIONS.items():
        statement = (
            f"UPDATE public.modelcatalog_dataset_specification "
            f"SET \"position\" = {position} "
            f"WHERE id = '{output_id}' AND \"position\" IS NULL;"
        )
        assert statement in up


def test_down_migration_does_not_clear_valid_positions():
    down = " ".join((MIGRATION / "down.sql").read_text().split())
    assert "UPDATE public.modelcatalog_dataset_specification" not in down
    assert "not reversible" in down
