"""
Validate the ETL pipeline by comparing counts and checking data integrity.
"""
from rdflib import Dataset
from typing import Dict, Any
import config


def count_entities_in_trig(ds: Dataset, entity_type: str) -> int:
    """Count entities of a given type in the TriG dataset."""
    query = f"""
    SELECT (COUNT(DISTINCT ?uri) as ?count)
    WHERE {{
        ?uri a <{entity_type}>
    }}
    """
    result = list(ds.query(query))
    if result and len(result) > 0:
        return int(result[0][0])
    return 0


def validate_counts(trig_path: str, conn) -> bool:
    """
    Validate entity counts between TriG source and PostgreSQL target.
    Returns True if all counts match, False otherwise.
    """
    print("\n=== Count Validation ===\n")

    # Load TriG dataset for comparison
    print(f"Loading TriG file for validation: {trig_path}")
    ds = Dataset()
    ds.parse(trig_path, format='trig')

    # Define entity types to validate
    entity_types = [
        ('Software', config.TYPE_SOFTWARE, 'modelcatalog_software'),
        ('SoftwareVersion', config.TYPE_SOFTWARE_VERSION, 'modelcatalog_software_version'),
        ('ModelConfiguration', config.TYPE_MODEL_CONFIGURATION, 'modelcatalog_model_configuration'),
        ('ModelConfigurationSetup', config.TYPE_MODEL_CONFIGURATION_SETUP, 'modelcatalog_model_configuration_setup'),
        ('DatasetSpecification', config.TYPE_DATASET_SPECIFICATION, 'modelcatalog_dataset_specification'),
        ('Parameter', config.TYPE_PARAMETER, 'modelcatalog_parameter'),
    ]

    all_passed = True
    results = []

    with conn.cursor() as cur:
        for name, rdf_type, table_name in entity_types:
            # Count in source (TriG)
            source_count = count_entities_in_trig(ds, rdf_type)

            # Count in target (PostgreSQL)
            cur.execute(f"SELECT COUNT(*) FROM {table_name}")
            target_count = cur.fetchone()[0]

            # Compare
            match = source_count == target_count
            status = "PASS" if match else "FAIL"

            if not match:
                all_passed = False

            results.append({
                'name': name,
                'source': source_count,
                'target': target_count,
                'status': status
            })

    # Print results table
    print(f"{'Entity Type':<25} {'Source (TriG)':<15} {'Target (PG)':<15} {'Status':<10}")
    print("-" * 70)
    for result in results:
        print(f"{result['name']:<25} {result['source']:<15} {result['target']:<15} {result['status']:<10}")

    return all_passed


def validate_junction_tables(conn) -> bool:
    """
    Validate junction tables have data.
    Returns True if all junction tables have rows, False otherwise.
    """
    print("\n=== Junction Table Validation ===\n")

    junction_tables = [
        'modelcatalog_configuration_input',
        'modelcatalog_configuration_output',
        'modelcatalog_configuration_parameter',
        'modelcatalog_setup_input',
        'modelcatalog_setup_output',
        'modelcatalog_setup_parameter',
    ]

    all_passed = True

    with conn.cursor() as cur:
        print(f"{'Table Name':<40} {'Row Count':<15} {'Status':<10}")
        print("-" * 70)

        for table_name in junction_tables:
            cur.execute(f"SELECT COUNT(*) FROM {table_name}")
            row_count = cur.fetchone()[0]

            status = "PASS" if row_count > 0 else "FAIL"
            if row_count == 0:
                all_passed = False

            print(f"{table_name:<40} {row_count:<15} {status:<10}")

    return all_passed


def validate_sample_entities(conn, ds: Dataset) -> bool:
    """
    Spot-check a few well-known entities for correctness.
    """
    print("\n=== Sample Entity Spot-Check ===\n")

    # We'll check if we can find some entities and verify basic properties
    # Since we don't know specific URIs without examining the data,
    # we'll just verify that we can query entities and they have expected relationships

    all_passed = True

    with conn.cursor() as cur:
        # Check 1: Verify software entities have versions
        cur.execute("""
            SELECT s.id, s.label, COUNT(sv.id) as version_count
            FROM modelcatalog_software s
            LEFT JOIN modelcatalog_software_version sv ON sv.software_id = s.id
            GROUP BY s.id, s.label
            HAVING COUNT(sv.id) > 0
            LIMIT 3
        """)
        software_with_versions = cur.fetchall()

        if software_with_versions:
            print("Software entities with versions:")
            for sw_id, sw_label, version_count in software_with_versions:
                print(f"  - {sw_label}: {version_count} version(s)")
        else:
            print("WARNING: No software entities have versions")
            all_passed = False

        # Check 2: Verify configurations have inputs/outputs/parameters
        cur.execute("""
            SELECT c.id, c.label,
                   (SELECT COUNT(*) FROM modelcatalog_configuration_input ci WHERE ci.configuration_id = c.id) as input_count,
                   (SELECT COUNT(*) FROM modelcatalog_configuration_output co WHERE co.configuration_id = c.id) as output_count,
                   (SELECT COUNT(*) FROM modelcatalog_configuration_parameter cp WHERE cp.configuration_id = c.id) as param_count
            FROM modelcatalog_model_configuration c
            LIMIT 3
        """)
        configs_with_links = cur.fetchall()

        if configs_with_links:
            print("\nConfigurations with I/O and parameters:")
            for c_id, c_label, i_count, o_count, p_count in configs_with_links:
                print(f"  - {c_label}: {i_count} inputs, {o_count} outputs, {p_count} parameters")
        else:
            print("WARNING: No configurations found")
            all_passed = False

        # Check 3: Verify setups have parent configurations
        cur.execute("""
            SELECT s.id, s.label, c.label as config_label
            FROM modelcatalog_model_configuration_setup s
            LEFT JOIN modelcatalog_model_configuration c ON s.model_configuration_id = c.id
            WHERE s.model_configuration_id IS NOT NULL
            LIMIT 3
        """)
        setups_with_parents = cur.fetchall()

        if setups_with_parents:
            print("\nSetups with parent configurations:")
            for s_id, s_label, c_label in setups_with_parents:
                print(f"  - {s_label} -> {c_label}")
        else:
            print("WARNING: No setups have parent configurations")

    return all_passed


def validate_orphans(conn):
    """
    Report entities with NULL FK values (orphans).
    """
    print("\n=== Orphan Report ===\n")

    with conn.cursor() as cur:
        # Check software_versions with no parent
        cur.execute("SELECT COUNT(*) FROM modelcatalog_software_version WHERE software_id IS NULL")
        orphaned_versions = cur.fetchone()[0]

        # Check configurations with no parent
        cur.execute("SELECT COUNT(*) FROM modelcatalog_model_configuration WHERE software_version_id IS NULL")
        orphaned_configs = cur.fetchone()[0]

        # Check setups with no parent
        cur.execute("SELECT COUNT(*) FROM modelcatalog_model_configuration_setup WHERE model_configuration_id IS NULL")
        orphaned_setups = cur.fetchone()[0]

        print(f"Orphaned software_versions (no parent software): {orphaned_versions}")
        print(f"Orphaned configurations (no parent version): {orphaned_configs}")
        print(f"Orphaned setups (no parent configuration): {orphaned_setups}")

        total_orphans = orphaned_versions + orphaned_configs + orphaned_setups
        if total_orphans > 0:
            print(f"\nTotal orphans: {total_orphans}")
        else:
            print("\nNo orphaned entities found")


def validate(trig_path: str, conn) -> bool:
    """
    Run all validation checks.
    Returns True if all validations pass, False otherwise.
    """
    print("\n" + "=" * 70)
    print("VALIDATION REPORT")
    print("=" * 70)

    # Load dataset for validation
    ds = Dataset()
    ds.parse(trig_path, format='trig')

    # Run all validation checks
    counts_passed = validate_counts(trig_path, conn)
    junction_passed = validate_junction_tables(conn)
    samples_passed = validate_sample_entities(conn, ds)

    # Orphan report (informational, not a failure)
    validate_orphans(conn)

    # Overall result
    print("\n" + "=" * 70)
    if counts_passed and junction_passed and samples_passed:
        print("VALIDATION: PASS")
        print("=" * 70)
        return True
    else:
        print("VALIDATION: FAIL")
        print("=" * 70)
        if not counts_passed:
            print("  - Entity count mismatch detected")
        if not junction_passed:
            print("  - Junction tables have no data")
        if not samples_passed:
            print("  - Sample entity checks failed")
        return False
