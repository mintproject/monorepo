"""
Configuration for the Model Catalog ETL pipeline.
"""
import os

# TriG file path (relative to etl/ directory or absolute)
TRIG_FILE = os.environ.get(
    'TRIG_FILE',
    '../model-catalog-endpoint/data/model-catalog.trig'
)

# Database connection parameters
DB_HOST = os.environ.get('DB_HOST', 'localhost')
DB_PORT = int(os.environ.get('DB_PORT', '5432'))
DB_NAME = os.environ.get('DB_NAME', 'postgres')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', 'postgres')

# RDF namespaces
SD = "https://w3id.org/okn/o/sd#"
SDM = "https://w3id.org/okn/o/sdm#"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"

# Entity type URIs
TYPE_SOFTWARE = f"{SDM}Model"
TYPE_SOFTWARE_VERSION = f"{SD}SoftwareVersion"
TYPE_MODEL_CONFIGURATION = f"{SDM}ModelConfiguration"
TYPE_MODEL_CONFIGURATION_SETUP = f"{SDM}ModelConfigurationSetup"
TYPE_DATASET_SPECIFICATION = f"{SD}DatasetSpecification"
TYPE_PARAMETER = f"{SD}Parameter"
TYPE_ADJUSTMENT = "https://w3id.org/wings/export/MINT#Adjustment"
TYPE_STANDARD_VARIABLE = f"{SD}StandardVariable"
TYPE_UNIT = "http://qudt.org/1.1/schema/qudt#Unit"  # QUDT ontology, NOT sd:Unit
