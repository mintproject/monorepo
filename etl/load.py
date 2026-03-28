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
                modelcatalog_software_category,
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


def load_self_referential_table(conn, table_name: str, rows: List[Dict[str, Any]], self_ref_column: str, page_size: int = 500):
    """
    Load self-referential table in two passes to avoid FK constraint violations.
    Pass 1: Load rows without self-referential FK column
    Pass 2: Update rows with self-referential FK values
    """
    if not rows:
        print(f"  - {table_name}: 0 rows (skipped)")
        return

    # Pass 1: Insert rows without self-referential FK
    rows_without_fk = []
    for row in rows:
        row_copy = row.copy()
        # Remove self-referential FK column
        if self_ref_column in row_copy:
            del row_copy[self_ref_column]
        rows_without_fk.append(row_copy)

    # Get column names from first row (without FK column)
    columns = list(rows_without_fk[0].keys())
    placeholders = ', '.join(['%s'] * len(columns))
    column_names = ', '.join(columns)

    insert_sql = f"""
        INSERT INTO {table_name} ({column_names})
        VALUES ({placeholders})
        ON CONFLICT (id) DO NOTHING
    """

    # Convert rows to tuples
    data = [tuple(row[col] for col in columns) for row in rows_without_fk]

    # Execute batch insert
    with conn.cursor() as cur:
        execute_batch(cur, insert_sql, data, page_size=page_size)

    print(f"  - {table_name}: {len(rows)} rows inserted (pass 1: entities)")

    # Pass 2: Update self-referential FK for rows that have it
    rows_with_fk = [row for row in rows if row.get(self_ref_column) is not None]

    if rows_with_fk:
        update_sql = f"""
            UPDATE {table_name}
            SET {self_ref_column} = %s
            WHERE id = %s
        """
        update_data = [(row[self_ref_column], row['id']) for row in rows_with_fk]

        with conn.cursor() as cur:
            execute_batch(cur, update_sql, update_data, page_size=page_size)

        print(f"  - {table_name}: {len(rows_with_fk)} parent relationships updated (pass 2: FKs)")


def load_all(transformed_data: Dict[str, List[Dict[str, Any]]], conn):
    """
    Load all transformed data into PostgreSQL in proper FK dependency order.
    """
    print("\nLoading data into PostgreSQL...")

    # Define self-referential tables and their FK columns
    self_referential_tables = {
        'modelcatalog_model_category': 'parent_category_id',
        'modelcatalog_region': 'part_of_id',
    }

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
        # Self-referential entity tables (loaded in two passes)
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
        # New Software junction tables
        'modelcatalog_software_category',
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
            if table_name in self_referential_tables:
                # Use special two-pass loading for self-referential tables
                load_self_referential_table(
                    conn,
                    table_name,
                    transformed_data[table_name],
                    self_referential_tables[table_name]
                )
            else:
                # Use regular loading for other tables
                load_table(conn, table_name, transformed_data[table_name])

    conn.commit()
    print("\nAll data loaded successfully")
