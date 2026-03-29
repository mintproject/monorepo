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
                modelcatalog_setup_parameter,
                modelcatalog_setup_output,
                modelcatalog_setup_input,
                modelcatalog_configuration_parameter,
                modelcatalog_configuration_output,
                modelcatalog_configuration_input,
                modelcatalog_model_configuration_setup,
                modelcatalog_model_configuration,
                modelcatalog_software_version,
                modelcatalog_software,
                modelcatalog_dataset_specification,
                modelcatalog_parameter,
                modelcatalog_standard_variable,
                modelcatalog_unit
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
    if table_name.startswith('modelcatalog_configuration_') or table_name.startswith('modelcatalog_setup_'):
        # Junction tables - no primary key, use ON CONFLICT DO NOTHING
        insert_sql = f"""
            INSERT INTO {table_name} ({column_names})
            VALUES ({placeholders})
            ON CONFLICT DO NOTHING
        """
    else:
        # Entity tables - use id as conflict target
        insert_sql = f"""
            INSERT INTO {table_name} ({column_names})
            VALUES ({placeholders})
            ON CONFLICT (id) DO NOTHING
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
        # Entity tables with no FK dependencies first
        'modelcatalog_software',
        'modelcatalog_dataset_specification',
        'modelcatalog_parameter',
        'modelcatalog_standard_variable',
        'modelcatalog_unit',
        # Then tables with FK dependencies in hierarchical order
        'modelcatalog_software_version',
        'modelcatalog_model_configuration',
        'modelcatalog_model_configuration_setup',
        # Finally junction tables
        'modelcatalog_configuration_input',
        'modelcatalog_configuration_output',
        'modelcatalog_configuration_parameter',
        'modelcatalog_setup_input',
        'modelcatalog_setup_output',
        'modelcatalog_setup_parameter',
    ]

    for table_name in load_order:
        if table_name in transformed_data:
            load_table(conn, table_name, transformed_data[table_name])

    conn.commit()
    print("\nAll data loaded successfully")
