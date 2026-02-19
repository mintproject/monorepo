"""
Load transformed data into PostgreSQL with proper FK ordering.
"""
import psycopg2
from psycopg2.extras import execute_batch
from typing import Dict, List, Any


def get_db_connection(config):
    """Create a PostgreSQL database connection."""
    return psycopg2.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        dbname=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASSWORD
    )


def clear_all(conn):
    """Clear all modelcatalog tables in reverse dependency order."""
    print("Clearing existing data...")
    with conn.cursor() as cur:
        # Truncate all tables with CASCADE to handle FKs
        cur.execute("""
            TRUNCATE TABLE
                -- New junction tables (14)
                modelcatalog_diagram_part,
                modelcatalog_parameter_intervention,
                modelcatalog_setup_calibration_target,
                modelcatalog_setup_calibrated_variable,
                modelcatalog_setup_author,
                modelcatalog_configuration_region,
                modelcatalog_configuration_time_interval,
                modelcatalog_configuration_causal_diagram,
                modelcatalog_software_version_output_variable,
                modelcatalog_software_version_input_variable,
                modelcatalog_software_version_image,
                modelcatalog_software_version_grid,
                modelcatalog_software_version_process,
                modelcatalog_software_version_category,
                -- Original junction tables (6)
                modelcatalog_setup_parameter,
                modelcatalog_setup_output,
                modelcatalog_setup_input,
                modelcatalog_configuration_parameter,
                modelcatalog_configuration_output,
                modelcatalog_configuration_input,
                -- Original entity tables (6)
                modelcatalog_model_configuration_setup,
                modelcatalog_model_configuration,
                modelcatalog_software_version,
                modelcatalog_software,
                modelcatalog_dataset_specification,
                modelcatalog_parameter,
                -- New entity tables (10)
                modelcatalog_person,
                modelcatalog_model_category,
                modelcatalog_region,
                modelcatalog_process,
                modelcatalog_time_interval,
                modelcatalog_causal_diagram,
                modelcatalog_image,
                modelcatalog_variable_presentation,
                modelcatalog_intervention,
                modelcatalog_grid
            CASCADE
        """)
    conn.commit()
    print("All tables cleared")


def load_table(conn, table_name: str, rows: List[Dict[str, Any]], page_size: int = 500):
    """
    Load rows into a table using execute_batch for efficiency.
    """
    if not rows:
        print(f"  - {table_name}: 0 rows (skipped)")
        return

    # Get column names from first row
    columns = list(rows[0].keys())
    placeholders = ', '.join(['%s'] * len(columns))
    column_names = ', '.join(columns)

    # Build INSERT statement with ON CONFLICT handling
    if 'id' in rows[0]:
        # Entity table with id primary key
        insert_sql = f"""
            INSERT INTO {table_name} ({column_names})
            VALUES ({placeholders})
            ON CONFLICT (id) DO NOTHING
        """
    else:
        # Junction table - use generic ON CONFLICT
        insert_sql = f"""
            INSERT INTO {table_name} ({column_names})
            VALUES ({placeholders})
            ON CONFLICT DO NOTHING
        """

    # Convert rows to tuples
    data = [tuple(row[col] for col in columns) for row in rows]

    # Execute batch insert
    with conn.cursor() as cur:
        execute_batch(cur, insert_sql, data, page_size=page_size)

    print(f"  - {table_name}: {len(rows)} rows inserted")


def load_all(transformed_data: Dict[str, List[Dict[str, Any]]], conn):
    """
    Load all transformed data into PostgreSQL in proper FK dependency order.
    """
    print("\nLoading data into PostgreSQL...")

    # Loading order matters due to FK constraints
    load_order = [
        # New entity tables with no FK dependencies
        'modelcatalog_person',
        'modelcatalog_process',
        'modelcatalog_time_interval',
        'modelcatalog_causal_diagram',
        'modelcatalog_image',
        'modelcatalog_variable_presentation',
        'modelcatalog_intervention',
        'modelcatalog_grid',
        # Self-referential entity tables (load entities first, parent refs resolved by ON CONFLICT)
        'modelcatalog_model_category',
        'modelcatalog_region',
        # Original entity tables with no FK dependencies
        'modelcatalog_software',
        'modelcatalog_dataset_specification',
        'modelcatalog_parameter',
        # Original hierarchy tables
        'modelcatalog_software_version',
        'modelcatalog_model_configuration',
        'modelcatalog_model_configuration_setup',
        # Original junction tables (6)
        'modelcatalog_configuration_input',
        'modelcatalog_configuration_output',
        'modelcatalog_configuration_parameter',
        'modelcatalog_setup_input',
        'modelcatalog_setup_output',
        'modelcatalog_setup_parameter',
        # New SoftwareVersion junction tables (6)
        'modelcatalog_software_version_category',
        'modelcatalog_software_version_process',
        'modelcatalog_software_version_grid',
        'modelcatalog_software_version_image',
        'modelcatalog_software_version_input_variable',
        'modelcatalog_software_version_output_variable',
        # New Configuration junction tables (3)
        'modelcatalog_configuration_causal_diagram',
        'modelcatalog_configuration_time_interval',
        'modelcatalog_configuration_region',
        # New Setup junction tables (3)
        'modelcatalog_setup_author',
        'modelcatalog_setup_calibrated_variable',
        'modelcatalog_setup_calibration_target',
        # New Parameter junction table (1)
        'modelcatalog_parameter_intervention',
        # New CausalDiagram parts (1)
        'modelcatalog_diagram_part',
    ]

    for table_name in load_order:
        if table_name in transformed_data:
            load_table(conn, table_name, transformed_data[table_name])

    conn.commit()
    print("\nAll data loaded successfully")
