"""
ETL Pipeline Orchestrator

Runs the complete ETL pipeline: extract -> transform -> load -> validate
"""
import argparse
import sys
import time
import os

# Add current directory to path so we can import local modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
import extract
import transform
import load
import validate


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description='Model Catalog ETL Pipeline - Extract, Transform, Load, and Validate'
    )

    parser.add_argument(
        '--trig-path',
        default=config.TRIG_FILE,
        help=f'Path to TriG file (default: {config.TRIG_FILE})'
    )

    parser.add_argument(
        '--db-host',
        default=config.DB_HOST,
        help=f'Database host (default: {config.DB_HOST})'
    )

    parser.add_argument(
        '--db-port',
        type=int,
        default=config.DB_PORT,
        help=f'Database port (default: {config.DB_PORT})'
    )

    parser.add_argument(
        '--db-name',
        default=config.DB_NAME,
        help=f'Database name (default: {config.DB_NAME})'
    )

    parser.add_argument(
        '--db-user',
        default=config.DB_USER,
        help=f'Database user (default: {config.DB_USER})'
    )

    parser.add_argument(
        '--db-password',
        default=config.DB_PASSWORD,
        help='Database password (default: from config)'
    )

    parser.add_argument(
        '--clear',
        action='store_true',
        help='Clear existing data before loading'
    )

    parser.add_argument(
        '--validate-only',
        action='store_true',
        help='Skip ETL and only run validation'
    )

    return parser.parse_args()


def format_duration(seconds):
    """Format duration in seconds to a readable string."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}m"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}h"


def main():
    """Run the ETL pipeline."""
    args = parse_args()

    # Override config with CLI args if provided
    if args.trig_path != config.TRIG_FILE:
        config.TRIG_FILE = args.trig_path
    if args.db_host != config.DB_HOST:
        config.DB_HOST = args.db_host
    if args.db_port != config.DB_PORT:
        config.DB_PORT = args.db_port
    if args.db_name != config.DB_NAME:
        config.DB_NAME = args.db_name
    if args.db_user != config.DB_USER:
        config.DB_USER = args.db_user
    if args.db_password != config.DB_PASSWORD:
        config.DB_PASSWORD = args.db_password

    print("=" * 70)
    print("MODEL CATALOG ETL PIPELINE")
    print("=" * 70)
    print(f"TriG file: {args.trig_path}")
    print(f"Database: {args.db_user}@{args.db_host}:{args.db_port}/{args.db_name}")
    print("=" * 70)

    # Convert relative path to absolute if needed
    trig_path = args.trig_path
    if not os.path.isabs(trig_path):
        # Resolve relative to the etl/ directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        trig_path = os.path.join(script_dir, trig_path)

    if not os.path.exists(trig_path):
        print(f"\nERROR: TriG file not found: {trig_path}")
        return 1

    overall_start = time.time()

    # Get database connection
    try:
        conn = load.get_db_connection(config)
        print("\nDatabase connection established")
    except Exception as e:
        print(f"\nERROR: Failed to connect to database: {e}")
        return 1

    try:
        if args.validate_only:
            # Skip ETL, just validate
            print("\nSkipping ETL (validate-only mode)")
            validation_passed = validate.validate(trig_path, conn)
        else:
            # Run full ETL pipeline

            # EXTRACT
            print("\n" + "=" * 70)
            print("PHASE 1: EXTRACT")
            print("=" * 70)
            extract_start = time.time()
            extracted_data = extract.extract_all(trig_path)
            extract_duration = time.time() - extract_start
            print(f"\nExtraction complete in {format_duration(extract_duration)}")

            # TRANSFORM
            print("\n" + "=" * 70)
            print("PHASE 2: TRANSFORM")
            print("=" * 70)
            transform_start = time.time()
            transformed_data = transform.transform_all(extracted_data)
            transform_duration = time.time() - transform_start
            print(f"\nTransformation complete in {format_duration(transform_duration)}")

            # LOAD
            print("\n" + "=" * 70)
            print("PHASE 3: LOAD")
            print("=" * 70)

            if args.clear:
                load.clear_all(conn)

            load_start = time.time()
            load.load_all(transformed_data, conn)
            load_duration = time.time() - load_start
            print(f"\nLoad complete in {format_duration(load_duration)}")

            # VALIDATE
            print("\n" + "=" * 70)
            print("PHASE 4: VALIDATE")
            print("=" * 70)
            validate_start = time.time()
            validation_passed = validate.validate(trig_path, conn)
            validate_duration = time.time() - validate_start
            print(f"\nValidation complete in {format_duration(validate_duration)}")

        overall_duration = time.time() - overall_start

        # Final summary
        print("\n" + "=" * 70)
        print("PIPELINE SUMMARY")
        print("=" * 70)
        if not args.validate_only:
            print(f"Extract:   {format_duration(extract_duration)}")
            print(f"Transform: {format_duration(transform_duration)}")
            print(f"Load:      {format_duration(load_duration)}")
            print(f"Validate:  {format_duration(validate_duration)}")
        print(f"Total:     {format_duration(overall_duration)}")
        print("=" * 70)

        if validation_passed:
            print("\nSUCCESS: ETL pipeline completed successfully")
            return 0
        else:
            print("\nFAILURE: Validation failed")
            return 1

    except Exception as e:
        print(f"\nERROR: Pipeline failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
