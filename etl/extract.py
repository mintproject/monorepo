"""
Extract entities from the TriG RDF dump using SPARQL queries.
"""
from rdflib import Dataset, Graph, Namespace, RDF, RDFS
from typing import List, Dict, Any
import config

# Define namespaces
SD = Namespace(config.SD)
SDM = Namespace(config.SDM)


def load_dataset(trig_path: str) -> Graph:
    """
    Load the TriG file into an RDFLib Dataset and return a union Graph.

    TriG files contain named graphs (quads). To query across all graphs,
    we create a union of all contexts.
    """
    print(f"Loading TriG file: {trig_path}")
    ds = Dataset()
    ds.parse(trig_path, format='trig')
    print(f"Loaded {len(ds)} quads from dataset")

    # Create a union graph from all contexts
    # This allows SPARQL queries to work across all named graphs
    union_graph = Graph()
    for context in ds.contexts():
        for triple in context:
            union_graph.add(triple)

    print(f"Created union graph with {len(union_graph)} triples")
    return union_graph


def extract_software(ds: Graph) -> List[Dict[str, Any]]:
    """Extract Software entities (sdm#Model)."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?keywords ?license ?website
                    ?date_created ?date_published ?has_documentation
                    ?has_download_url ?has_purpose
    WHERE {{
        ?id a <{config.TYPE_SOFTWARE}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:keywords ?keywords }}
        OPTIONAL {{ ?id sd:license ?license }}
        OPTIONAL {{ ?id sd:website ?website }}
        OPTIONAL {{ ?id sd:dateCreated ?date_created }}
        OPTIONAL {{ ?id sd:datePublished ?date_published }}
        OPTIONAL {{ ?id sd:hasDocumentation ?has_documentation }}
        OPTIONAL {{ ?id sd:hasDownloadURL ?has_download_url }}
        OPTIONAL {{ ?id sd:hasPurpose ?has_purpose }}
    }}
    """

    results = []
    version_links = {}

    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
            'keywords': str(row.keywords) if row.keywords else None,
            'license': str(row.license) if row.license else None,
            'website': str(row.website) if row.website else None,
            'date_created': str(row.date_created) if row.date_created else None,
            'date_published': str(row.date_published) if row.date_published else None,
            'has_documentation': str(row.has_documentation) if row.has_documentation else None,
            'has_download_url': str(row.has_download_url) if row.has_download_url else None,
            'has_purpose': str(row.has_purpose) if row.has_purpose else None,
        }
        results.append(entity)

    # Extract hasVersion links
    version_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?software ?version
    WHERE {{
        ?software a <{config.TYPE_SOFTWARE}> .
        ?software sd:hasVersion ?version .
    }}
    """

    for row in ds.query(version_query):
        software_id = str(row.software)
        version_id = str(row.version)
        if software_id not in version_links:
            version_links[software_id] = []
        version_links[software_id].append(version_id)

    print(f"Extracted {len(results)} Software entities")
    return results, version_links


def extract_software_versions(ds: Graph) -> List[Dict[str, Any]]:
    """Extract SoftwareVersion entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?keywords ?has_usage_notes
                    ?date_created ?has_source_code ?version_id
    WHERE {{
        ?id a <{config.TYPE_SOFTWARE_VERSION}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:keywords ?keywords }}
        OPTIONAL {{ ?id sd:hasUsageNotes ?has_usage_notes }}
        OPTIONAL {{ ?id sd:dateCreated ?date_created }}
        OPTIONAL {{ ?id sd:hasSourceCode ?has_source_code }}
        OPTIONAL {{ ?id sd:hasVersionId ?version_id }}
    }}
    """

    results = []
    configuration_links = {}

    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
            'keywords': str(row.keywords) if row.keywords else None,
            'has_usage_notes': str(row.has_usage_notes) if row.has_usage_notes else None,
            'date_created': str(row.date_created) if row.date_created else None,
            'has_source_code': str(row.has_source_code) if row.has_source_code else None,
            'version_id': str(row.version_id) if row.version_id else None,
        }
        results.append(entity)

    # Extract hasConfiguration links
    config_query = f"""
    PREFIX sd: <{config.SD}>

    SELECT DISTINCT ?version ?configuration
    WHERE {{
        ?version a <{config.TYPE_SOFTWARE_VERSION}> .
        ?version sd:hasConfiguration ?configuration .
    }}
    """

    for row in ds.query(config_query):
        version_id = str(row.version)
        config_id = str(row.configuration)
        if version_id not in configuration_links:
            configuration_links[version_id] = []
        configuration_links[version_id].append(config_id)

    print(f"Extracted {len(results)} SoftwareVersion entities")
    return results, configuration_links


def extract_model_configurations(ds: Graph) -> List[Dict[str, Any]]:
    """Extract ModelConfiguration entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?keywords ?usage_notes
                    ?has_component_location ?has_implementation_script_location
                    ?has_software_image
    WHERE {{
        ?id a <{config.TYPE_MODEL_CONFIGURATION}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:keywords ?keywords }}
        OPTIONAL {{ ?id sd:hasUsageNotes ?usage_notes }}
        OPTIONAL {{ ?id sd:hasComponentLocation ?has_component_location }}
        OPTIONAL {{ ?id sd:hasImplementationScriptLocation ?has_implementation_script_location }}
        OPTIONAL {{ ?id sd:hasSoftwareImage ?has_software_image }}
    }}
    """

    results = []
    setup_links = {}
    input_links = {}
    output_links = {}
    parameter_links = {}

    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
            'keywords': str(row.keywords) if row.keywords else None,
            'usage_notes': str(row.usage_notes) if row.usage_notes else None,
            'has_component_location': str(row.has_component_location) if row.has_component_location else None,
            'has_implementation_script_location': str(row.has_implementation_script_location) if row.has_implementation_script_location else None,
            'has_software_image': str(row.has_software_image) if row.has_software_image else None,
        }
        results.append(entity)

    # Extract hasSetup links
    setup_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?configuration ?setup
    WHERE {{
        ?configuration a <{config.TYPE_MODEL_CONFIGURATION}> .
        ?configuration sd:hasSetup ?setup .
    }}
    """

    for row in ds.query(setup_query):
        config_id = str(row.configuration)
        setup_id = str(row.setup)
        if config_id not in setup_links:
            setup_links[config_id] = []
        setup_links[config_id].append(setup_id)

    # Extract hasInput links
    input_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?configuration ?input
    WHERE {{
        ?configuration a <{config.TYPE_MODEL_CONFIGURATION}> .
        ?configuration sd:hasInput ?input .
    }}
    """

    for row in ds.query(input_query):
        config_id = str(row.configuration)
        input_id = str(row.input)
        if config_id not in input_links:
            input_links[config_id] = []
        input_links[config_id].append(input_id)

    # Extract hasOutput links
    output_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?configuration ?output
    WHERE {{
        ?configuration a <{config.TYPE_MODEL_CONFIGURATION}> .
        ?configuration sd:hasOutput ?output .
    }}
    """

    for row in ds.query(output_query):
        config_id = str(row.configuration)
        output_id = str(row.output)
        if config_id not in output_links:
            output_links[config_id] = []
        output_links[config_id].append(output_id)

    # Extract hasParameter links
    param_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?configuration ?parameter
    WHERE {{
        ?configuration a <{config.TYPE_MODEL_CONFIGURATION}> .
        ?configuration sd:hasParameter ?parameter .
    }}
    """

    for row in ds.query(param_query):
        config_id = str(row.configuration)
        param_id = str(row.parameter)
        if config_id not in parameter_links:
            parameter_links[config_id] = []
        parameter_links[config_id].append(param_id)

    print(f"Extracted {len(results)} ModelConfiguration entities")
    return results, {
        'setup': setup_links,
        'input': input_links,
        'output': output_links,
        'parameter': parameter_links
    }


def extract_model_configuration_setups(ds: Graph) -> List[Dict[str, Any]]:
    """Extract ModelConfigurationSetup entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?has_component_location
                    ?has_implementation_script_location ?has_software_image
                    ?has_region
    WHERE {{
        ?id a <{config.TYPE_MODEL_CONFIGURATION_SETUP}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:hasComponentLocation ?has_component_location }}
        OPTIONAL {{ ?id sd:hasImplementationScriptLocation ?has_implementation_script_location }}
        OPTIONAL {{ ?id sd:hasSoftwareImage ?has_software_image }}
        OPTIONAL {{ ?id sdm:hasRegion ?has_region }}
    }}
    """

    results = []
    input_links = {}
    output_links = {}
    parameter_links = {}

    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
            'has_component_location': str(row.has_component_location) if row.has_component_location else None,
            'has_implementation_script_location': str(row.has_implementation_script_location) if row.has_implementation_script_location else None,
            'has_software_image': str(row.has_software_image) if row.has_software_image else None,
            'has_region': str(row.has_region) if row.has_region else None,
        }
        results.append(entity)

    # Extract hasInput links
    input_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?setup ?input
    WHERE {{
        ?setup a <{config.TYPE_MODEL_CONFIGURATION_SETUP}> .
        ?setup sd:hasInput ?input .
    }}
    """

    for row in ds.query(input_query):
        setup_id = str(row.setup)
        input_id = str(row.input)
        if setup_id not in input_links:
            input_links[setup_id] = []
        input_links[setup_id].append(input_id)

    # Extract hasOutput links
    output_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?setup ?output
    WHERE {{
        ?setup a <{config.TYPE_MODEL_CONFIGURATION_SETUP}> .
        ?setup sd:hasOutput ?output .
    }}
    """

    for row in ds.query(output_query):
        setup_id = str(row.setup)
        output_id = str(row.output)
        if setup_id not in output_links:
            output_links[setup_id] = []
        output_links[setup_id].append(output_id)

    # Extract hasParameter links
    param_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?setup ?parameter
    WHERE {{
        ?setup a <{config.TYPE_MODEL_CONFIGURATION_SETUP}> .
        ?setup sd:hasParameter ?parameter .
    }}
    """

    for row in ds.query(param_query):
        setup_id = str(row.setup)
        param_id = str(row.parameter)
        if setup_id not in parameter_links:
            parameter_links[setup_id] = []
        parameter_links[setup_id].append(param_id)

    print(f"Extracted {len(results)} ModelConfigurationSetup entities")
    return results, {
        'input': input_links,
        'output': output_links,
        'parameter': parameter_links
    }


def extract_dataset_specifications(ds: Graph) -> List[Dict[str, Any]]:
    """Extract DatasetSpecification entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?has_format ?has_dimensionality ?position
    WHERE {{
        ?id a <{config.TYPE_DATASET_SPECIFICATION}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:hasFormat ?has_format }}
        OPTIONAL {{ ?id sd:hasDimensionality ?has_dimensionality }}
        OPTIONAL {{ ?id sd:position ?position }}
    }}
    """

    results = []
    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
            'has_format': str(row.has_format) if row.has_format else None,
            'has_dimensionality': str(row.has_dimensionality) if row.has_dimensionality else None,
            'position': str(row.position) if row.position else None,
        }
        results.append(entity)

    print(f"Extracted {len(results)} DatasetSpecification entities")
    return results


def extract_parameters(ds: Graph) -> List[Dict[str, Any]]:
    """Extract Parameter entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?has_data_type ?has_default_value
                    ?has_minimum_accepted_value ?has_maximum_accepted_value
                    ?has_fixed_value ?position
    WHERE {{
        ?id a <{config.TYPE_PARAMETER}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:hasDataType ?has_data_type }}
        OPTIONAL {{ ?id sd:hasDefaultValue ?has_default_value }}
        OPTIONAL {{ ?id sd:hasMinimumAcceptedValue ?has_minimum_accepted_value }}
        OPTIONAL {{ ?id sd:hasMaximumAcceptedValue ?has_maximum_accepted_value }}
        OPTIONAL {{ ?id sd:hasFixedValue ?has_fixed_value }}
        OPTIONAL {{ ?id sd:position ?position }}
    }}
    """

    results = []
    for row in ds.query(query):
        # Determine parameter type
        param_id = str(row.id)
        is_adjustment = False

        # Check if this parameter also has Adjustment type
        adj_query = f"""
        PREFIX rdf: <{config.RDF}>
        ASK {{ <{param_id}> rdf:type <{config.TYPE_ADJUSTMENT}> }}
        """
        is_adjustment = ds.query(adj_query).askAnswer

        entity = {
            'id': param_id,
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
            'has_data_type': str(row.has_data_type) if row.has_data_type else None,
            'has_default_value': str(row.has_default_value) if row.has_default_value else None,
            'has_minimum_accepted_value': str(row.has_minimum_accepted_value) if row.has_minimum_accepted_value else None,
            'has_maximum_accepted_value': str(row.has_maximum_accepted_value) if row.has_maximum_accepted_value else None,
            'has_fixed_value': str(row.has_fixed_value) if row.has_fixed_value else None,
            'position': str(row.position) if row.position else None,
            'parameter_type': 'adjustment' if is_adjustment else 'standard',
        }
        results.append(entity)

    print(f"Extracted {len(results)} Parameter entities")
    return results


def extract_all(trig_path: str) -> Dict[str, Any]:
    """Extract all entities from the TriG file."""
    ds = load_dataset(trig_path)

    software, version_links = extract_software(ds)
    software_versions, configuration_links = extract_software_versions(ds)
    model_configurations, config_links = extract_model_configurations(ds)
    model_configuration_setups, setup_links = extract_model_configuration_setups(ds)
    dataset_specifications = extract_dataset_specifications(ds)
    parameters = extract_parameters(ds)

    return {
        'software': software,
        'software_versions': software_versions,
        'model_configurations': model_configurations,
        'model_configuration_setups': model_configuration_setups,
        'dataset_specifications': dataset_specifications,
        'parameters': parameters,
        'links': {
            'software_to_version': version_links,
            'version_to_configuration': configuration_links,
            'configuration': config_links,
            'setup': setup_links,
        }
    }
