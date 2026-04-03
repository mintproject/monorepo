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

    # Extract author links
    author_links = {}
    author_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?software ?author
    WHERE {{
        ?software a <{config.TYPE_SOFTWARE}> .
        ?software sd:author ?author .
    }}
    """

    for row in ds.query(author_query):
        software_id = str(row.software)
        author_id = str(row.author)
        if software_id not in author_links:
            author_links[software_id] = []
        author_links[software_id].append(author_id)

    # Extract hasModelCategory links
    category_links = {}
    category_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?software ?category
    WHERE {{
        ?software a <{config.TYPE_SOFTWARE}> .
        ?software sdm:hasModelCategory ?category .
    }}
    """

    for row in ds.query(category_query):
        software_id = str(row.software)
        category_id = str(row.category)
        if software_id not in category_links:
            category_links[software_id] = []
        category_links[software_id].append(category_id)

    # Set single-valued author_id on entities (first author)
    author_first = {}
    for sw_id, authors in author_links.items():
        if authors:
            author_first[sw_id] = authors[0]
    for entity in results:
        entity['author_id'] = author_first.get(entity['id'])

    # Extract rdf:type for software subtype classification
    type_query = f"""
    PREFIX sdm: <{config.SDM}>
    PREFIX rdf: <{config.RDF}>

    SELECT DISTINCT ?id ?rdftype
    WHERE {{
        ?id a <{config.TYPE_SOFTWARE}> .
        ?id rdf:type ?rdftype .
        FILTER(?rdftype != <{config.TYPE_SOFTWARE}>)
        FILTER(STRSTARTS(STR(?rdftype), "{config.SDM}"))
    }}
    """

    # Map entity ID -> most specific subtype URI
    subtype_map = {}
    for row in ds.query(type_query):
        entity_id = str(row.id)
        rdf_type = str(row.rdftype)
        # Keep the most specific subtype (not sdm:Model itself, which is the base)
        if entity_id not in subtype_map or rdf_type != f"{config.SDM}Model":
            subtype_map[entity_id] = rdf_type

    # Set type on each entity
    for entity in results:
        entity['type'] = subtype_map.get(entity['id'], f"{config.SDM}Model")

    print(f"Extracted {len(results)} Software entities")
    return results, version_links, author_links, category_links


def extract_software_versions(ds: Graph) -> List[Dict[str, Any]]:
    """Extract SoftwareVersion entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?keywords ?has_usage_notes
                    ?date_created ?has_source_code ?version_id
                    ?short_description ?limitations ?parameterization
                    ?runtime_estimation ?theoretical_basis
    WHERE {{
        ?id a <{config.TYPE_SOFTWARE_VERSION}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:keywords ?keywords }}
        OPTIONAL {{ ?id sd:hasUsageNotes ?has_usage_notes }}
        OPTIONAL {{ ?id sd:dateCreated ?date_created }}
        OPTIONAL {{ ?id sd:hasSourceCode ?has_source_code }}
        OPTIONAL {{ ?id sd:hasVersionId ?version_id }}
        OPTIONAL {{ ?id sd:shortDescription ?short_description }}
        OPTIONAL {{ ?id sdm:limitations ?limitations }}
        OPTIONAL {{ ?id sdm:parameterization ?parameterization }}
        OPTIONAL {{ ?id sdm:runtimeEstimation ?runtime_estimation }}
        OPTIONAL {{ ?id sdm:theoreticalBasis ?theoretical_basis }}
    }}
    """

    results = []
    configuration_links = {}
    category_links = {}
    process_links = {}
    grid_links = {}
    image_links = {}
    input_variable_links = {}
    output_variable_links = {}

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
            'short_description': str(row.short_description) if row.short_description else None,
            'limitations': str(row.limitations) if row.limitations else None,
            'parameterization': str(row.parameterization) if row.parameterization else None,
            'runtime_estimation': str(row.runtime_estimation) if row.runtime_estimation else None,
            'theoretical_basis': str(row.theoretical_basis) if row.theoretical_basis else None,
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

    # Extract hasModelCategory links
    category_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?version ?category
    WHERE {{
        ?version a <{config.TYPE_SOFTWARE_VERSION}> .
        ?version sdm:hasModelCategory ?category .
    }}
    """

    for row in ds.query(category_query):
        version_id = str(row.version)
        category_id = str(row.category)
        if version_id not in category_links:
            category_links[version_id] = []
        category_links[version_id].append(category_id)

    # Extract hasProcess links
    process_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?version ?process
    WHERE {{
        ?version a <{config.TYPE_SOFTWARE_VERSION}> .
        ?version sdm:hasProcess ?process .
    }}
    """

    for row in ds.query(process_query):
        version_id = str(row.version)
        process_id = str(row.process)
        if version_id not in process_links:
            process_links[version_id] = []
        process_links[version_id].append(process_id)

    # Extract hasGrid links
    grid_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?version ?grid
    WHERE {{
        ?version a <{config.TYPE_SOFTWARE_VERSION}> .
        ?version sdm:hasGrid ?grid .
    }}
    """

    for row in ds.query(grid_query):
        version_id = str(row.version)
        grid_id = str(row.grid)
        if version_id not in grid_links:
            grid_links[version_id] = []
        grid_links[version_id].append(grid_id)

    # Extract hasExplanationDiagram links
    image_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?version ?image
    WHERE {{
        ?version a <{config.TYPE_SOFTWARE_VERSION}> .
        ?version sdm:hasExplanationDiagram ?image .
    }}
    """

    for row in ds.query(image_query):
        version_id = str(row.version)
        image_id = str(row.image)
        if version_id not in image_links:
            image_links[version_id] = []
        image_links[version_id].append(image_id)

    # Extract hasInputVariable links
    input_var_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?version ?variable
    WHERE {{
        ?version a <{config.TYPE_SOFTWARE_VERSION}> .
        ?version sdm:hasInputVariable ?variable .
    }}
    """

    for row in ds.query(input_var_query):
        version_id = str(row.version)
        variable_id = str(row.variable)
        if version_id not in input_variable_links:
            input_variable_links[version_id] = []
        input_variable_links[version_id].append(variable_id)

    # Extract hasOutputVariable links
    output_var_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?version ?variable
    WHERE {{
        ?version a <{config.TYPE_SOFTWARE_VERSION}> .
        ?version sdm:hasOutputVariable ?variable .
    }}
    """

    for row in ds.query(output_var_query):
        version_id = str(row.version)
        variable_id = str(row.variable)
        if version_id not in output_variable_links:
            output_variable_links[version_id] = []
        output_variable_links[version_id].append(variable_id)

    # Extract author links
    author_links = {}
    author_query = f"""
    PREFIX sd: <{config.SD}>

    SELECT DISTINCT ?version ?author
    WHERE {{
        ?version a <{config.TYPE_SOFTWARE_VERSION}> .
        ?version sd:author ?author .
    }}
    """

    for row in ds.query(author_query):
        version_id = str(row.version)
        author_id = str(row.author)
        if version_id not in author_links:
            author_links[version_id] = []
        author_links[version_id].append(author_id)

    # Set single-valued author_id on entities (first author)
    author_first = {}
    for ver_id, authors in author_links.items():
        if authors:
            author_first[ver_id] = authors[0]
    for entity in results:
        entity['author_id'] = author_first.get(entity['id'])

    print(f"Extracted {len(results)} SoftwareVersion entities")
    return results, {
        'configuration': configuration_links,
        'category': category_links,
        'process': process_links,
        'grid': grid_links,
        'image': image_links,
        'input_variable': input_variable_links,
        'output_variable': output_variable_links,
        'author': author_links,
    }


def extract_model_configurations(ds: Graph) -> List[Dict[str, Any]]:
    """Extract ModelConfiguration entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?keywords ?usage_notes
                    ?has_component_location ?has_implementation_script_location
                    ?has_software_image ?has_model_result_table
    WHERE {{
        ?id a <{config.TYPE_MODEL_CONFIGURATION}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:keywords ?keywords }}
        OPTIONAL {{ ?id sd:hasUsageNotes ?usage_notes }}
        OPTIONAL {{ ?id sd:hasComponentLocation ?has_component_location }}
        OPTIONAL {{ ?id sd:hasImplementationScriptLocation ?has_implementation_script_location }}
        OPTIONAL {{ ?id sd:hasSoftwareImage ?has_software_image }}
        OPTIONAL {{ ?id sdm:hasModelResultTable ?has_model_result_table }}
    }}
    """

    results = []
    setup_links = {}
    input_links = {}
    output_links = {}
    parameter_links = {}
    causal_diagram_links = {}
    time_interval_links = {}
    region_links = {}

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
            'has_model_result_table': str(row.has_model_result_table) if row.has_model_result_table else None,
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

    # Extract hasCausalDiagram links
    causal_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?configuration ?diagram
    WHERE {{
        ?configuration a <{config.TYPE_MODEL_CONFIGURATION}> .
        ?configuration sdm:hasCausalDiagram ?diagram .
    }}
    """

    for row in ds.query(causal_query):
        config_id = str(row.configuration)
        diagram_id = str(row.diagram)
        if config_id not in causal_diagram_links:
            causal_diagram_links[config_id] = []
        causal_diagram_links[config_id].append(diagram_id)

    # Extract hasOutputTimeInterval links
    time_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?configuration ?time_interval
    WHERE {{
        ?configuration a <{config.TYPE_MODEL_CONFIGURATION}> .
        ?configuration sdm:hasOutputTimeInterval ?time_interval .
    }}
    """

    for row in ds.query(time_query):
        config_id = str(row.configuration)
        time_id = str(row.time_interval)
        if config_id not in time_interval_links:
            time_interval_links[config_id] = []
        time_interval_links[config_id].append(time_id)

    # Extract hasRegion links
    region_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?configuration ?region
    WHERE {{
        ?configuration a <{config.TYPE_MODEL_CONFIGURATION}> .
        ?configuration sdm:hasRegion ?region .
    }}
    """

    for row in ds.query(region_query):
        config_id = str(row.configuration)
        region_id = str(row.region)
        if config_id not in region_links:
            region_links[config_id] = []
        region_links[config_id].append(region_id)

    # Extract author links
    author_links = {}
    author_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?configuration ?author
    WHERE {{
        ?configuration a <{config.TYPE_MODEL_CONFIGURATION}> .
        ?configuration sd:author ?author .
    }}
    """

    for row in ds.query(author_query):
        config_id = str(row.configuration)
        author_id = str(row.author)
        if config_id not in author_links:
            author_links[config_id] = []
        author_links[config_id].append(author_id)

    # Set single-valued author_id on entities (first author)
    author_first = {}
    for cfg_id, authors in author_links.items():
        if authors:
            author_first[cfg_id] = authors[0]
    for entity in results:
        entity['author_id'] = author_first.get(entity['id'])

    # Extract hasModelCategory links
    category_links = {}
    category_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?mc ?category
    WHERE {{
        ?mc a <{config.TYPE_MODEL_CONFIGURATION}> .
        ?mc sdm:hasModelCategory ?category .
    }}
    """

    for row in ds.query(category_query):
        mc_id = str(row.mc)
        category_id = str(row.category)
        if mc_id not in category_links:
            category_links[mc_id] = []
        category_links[mc_id].append(category_id)

    print(f"Extracted {len(results)} ModelConfiguration entities")
    return results, {
        'setup': setup_links,
        'input': input_links,
        'output': output_links,
        'parameter': parameter_links,
        'causal_diagram': causal_diagram_links,
        'time_interval': time_interval_links,
        'region': region_links,
        'author': author_links,
        'category': category_links,
    }


def extract_model_configuration_setups(ds: Graph) -> List[Dict[str, Any]]:
    """Extract ModelConfigurationSetup entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?has_component_location
                    ?has_implementation_script_location ?has_software_image
                    ?has_region ?author_id ?calibration_interval
                    ?calibration_method ?parameter_assignment_method ?valid_until
    WHERE {{
        ?id a <{config.TYPE_MODEL_CONFIGURATION_SETUP}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:hasComponentLocation ?has_component_location }}
        OPTIONAL {{ ?id sd:hasImplementationScriptLocation ?has_implementation_script_location }}
        OPTIONAL {{ ?id sd:hasSoftwareImage ?has_software_image }}
        OPTIONAL {{ ?id sdm:hasRegion ?has_region }}
        OPTIONAL {{ ?id sd:author ?author_id }}
        OPTIONAL {{ ?id sdm:calibrationInterval ?calibration_interval }}
        OPTIONAL {{ ?id sdm:calibrationMethod ?calibration_method }}
        OPTIONAL {{ ?id sdm:parameterAssignmentMethod ?parameter_assignment_method }}
        OPTIONAL {{ ?id sdm:validUntil ?valid_until }}
    }}
    """

    results = []
    input_links = {}
    output_links = {}
    parameter_links = {}
    author_links = {}
    calibrated_variable_links = {}
    calibration_target_links = {}

    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
            'has_component_location': str(row.has_component_location) if row.has_component_location else None,
            'has_implementation_script_location': str(row.has_implementation_script_location) if row.has_implementation_script_location else None,
            'has_software_image': str(row.has_software_image) if row.has_software_image else None,
            'has_region': str(row.has_region) if row.has_region else None,
            'author_id': str(row.author_id) if row.author_id else None,
            'calibration_interval': str(row.calibration_interval) if row.calibration_interval else None,
            'calibration_method': str(row.calibration_method) if row.calibration_method else None,
            'parameter_assignment_method': str(row.parameter_assignment_method) if row.parameter_assignment_method else None,
            'valid_until': str(row.valid_until) if row.valid_until else None,
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

    # Extract author links (multi-valued for junction table)
    author_query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?setup ?author
    WHERE {{
        ?setup a <{config.TYPE_MODEL_CONFIGURATION_SETUP}> .
        ?setup sd:author ?author .
    }}
    """

    for row in ds.query(author_query):
        setup_id = str(row.setup)
        author_id = str(row.author)
        if setup_id not in author_links:
            author_links[setup_id] = []
        author_links[setup_id].append(author_id)

    # Extract calibratedVariable links
    calibrated_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?setup ?variable
    WHERE {{
        ?setup a <{config.TYPE_MODEL_CONFIGURATION_SETUP}> .
        ?setup sdm:calibratedVariable ?variable .
    }}
    """

    for row in ds.query(calibrated_query):
        setup_id = str(row.setup)
        variable_id = str(row.variable)
        if setup_id not in calibrated_variable_links:
            calibrated_variable_links[setup_id] = []
        calibrated_variable_links[setup_id].append(variable_id)

    # Extract calibrationTargetVariable links
    target_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?setup ?variable
    WHERE {{
        ?setup a <{config.TYPE_MODEL_CONFIGURATION_SETUP}> .
        ?setup sdm:calibrationTargetVariable ?variable .
    }}
    """

    for row in ds.query(target_query):
        setup_id = str(row.setup)
        variable_id = str(row.variable)
        if setup_id not in calibration_target_links:
            calibration_target_links[setup_id] = []
        calibration_target_links[setup_id].append(variable_id)

    # Extract hasModelCategory links
    mcs_category_links = {}
    mcs_category_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?setup ?category
    WHERE {{
        ?setup a <{config.TYPE_MODEL_CONFIGURATION_SETUP}> .
        ?setup sdm:hasModelCategory ?category .
    }}
    """

    for row in ds.query(mcs_category_query):
        setup_id = str(row.setup)
        category_id = str(row.category)
        if setup_id not in mcs_category_links:
            mcs_category_links[setup_id] = []
        mcs_category_links[setup_id].append(category_id)

    print(f"Extracted {len(results)} ModelConfigurationSetup entities")
    return results, {
        'input': input_links,
        'output': output_links,
        'parameter': parameter_links,
        'author': author_links,
        'calibrated_variable': calibrated_variable_links,
        'calibration_target': calibration_target_links,
        'category': mcs_category_links,
    }


def extract_dataset_specifications(ds: Graph) -> tuple:
    """Extract DatasetSpecification entities and hasPresentation links."""
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

    # Extract hasPresentation links
    presentation_links = {}
    pres_query = f"""
    PREFIX sd: <{config.SD}>

    SELECT DISTINCT ?dsi ?presentation
    WHERE {{
        ?dsi a <{config.TYPE_DATASET_SPECIFICATION}> .
        ?dsi sd:hasPresentation ?presentation .
    }}
    """

    for row in ds.query(pres_query):
        dsi_id = str(row.dsi)
        pres_id = str(row.presentation)
        if dsi_id not in presentation_links:
            presentation_links[dsi_id] = []
        presentation_links[dsi_id].append(pres_id)

    return results, presentation_links


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
    intervention_links = {}

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

    # Extract relevantForIntervention links
    intervention_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?parameter ?intervention
    WHERE {{
        ?parameter a <{config.TYPE_PARAMETER}> .
        ?parameter sdm:relevantForIntervention ?intervention .
    }}
    """

    for row in ds.query(intervention_query):
        param_id = str(row.parameter)
        intervention_id = str(row.intervention)
        if param_id not in intervention_links:
            intervention_links[param_id] = []
        intervention_links[param_id].append(intervention_id)

    # Extract adjustsVariable links
    adjusts_variable_links = {}
    adjusts_query = f"""
    PREFIX sd: <{config.SD}>

    SELECT DISTINCT ?parameter ?variable
    WHERE {{
        ?parameter a <{config.TYPE_PARAMETER}> .
        ?parameter sd:adjustsVariable ?variable .
    }}
    """

    for row in ds.query(adjusts_query):
        param_id = str(row.parameter)
        variable_id = str(row.variable)
        if param_id not in adjusts_variable_links:
            adjusts_variable_links[param_id] = []
        adjusts_variable_links[param_id].append(variable_id)

    print(f"Extracted {len(results)} Parameter entities")
    return results, intervention_links, adjusts_variable_links


def extract_persons(ds: Graph) -> List[Dict[str, Any]]:
    """Extract Person entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?name
    WHERE {{
        ?id a <{config.TYPE_PERSON}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:name ?name }}
    }}
    """

    results = []
    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'name': str(row.name) if row.name else None,
        }
        results.append(entity)

    print(f"Extracted {len(results)} Person entities")
    return results


def extract_model_categories(ds: Graph) -> List[Dict[str, Any]]:
    """Extract ModelCategory entities."""
    query = f"""
    PREFIX sdm: <{config.SDM}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?parent
    WHERE {{
        ?id a <{config.TYPE_MODEL_CATEGORY}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sdm:hasModelCategory ?parent }}
    }}
    """

    results = []
    parent_links = {}

    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
        }
        results.append(entity)

        # Track parent relationship
        if row.parent:
            parent_links[str(row.id)] = str(row.parent)

    print(f"Extracted {len(results)} ModelCategory entities")
    return results, parent_links


def extract_regions(ds: Graph) -> List[Dict[str, Any]]:
    """Extract Region entities."""
    query = f"""
    PREFIX sdm: <{config.SDM}>
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?part_of
    WHERE {{
        ?id a <{config.TYPE_REGION}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sdm:partOf ?part_of }}
    }}
    """

    results = []
    part_of_links = {}

    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
        }
        results.append(entity)

        # Track partOf relationship
        if row.part_of:
            part_of_links[str(row.id)] = str(row.part_of)

    print(f"Extracted {len(results)} Region entities")
    return results, part_of_links


def extract_processes(ds: Graph) -> List[Dict[str, Any]]:
    """Extract Process entities."""
    query = f"""
    PREFIX sdm: <{config.SDM}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label
    WHERE {{
        ?id a <{config.TYPE_PROCESS}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
    }}
    """

    results = []
    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
        }
        results.append(entity)

    print(f"Extracted {len(results)} Process entities")
    return results


def extract_time_intervals(ds: Graph) -> List[Dict[str, Any]]:
    """Extract TimeInterval entities."""
    query = f"""
    PREFIX sdm: <{config.SDM}>
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?interval_value ?interval_unit
    WHERE {{
        ?id a <{config.TYPE_TIME_INTERVAL}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sdm:intervalValue ?interval_value }}
        OPTIONAL {{ ?id sdm:intervalUnit ?interval_unit }}
    }}
    """

    results = []
    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
            'interval_value': str(row.interval_value) if row.interval_value else None,
            'interval_unit': str(row.interval_unit) if row.interval_unit else None,
        }
        results.append(entity)

    print(f"Extracted {len(results)} TimeInterval entities")
    return results


def extract_causal_diagrams(ds: Graph) -> List[Dict[str, Any]]:
    """Extract CausalDiagram entities."""
    query = f"""
    PREFIX sdm: <{config.SDM}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label
    WHERE {{
        ?id a <{config.TYPE_CAUSAL_DIAGRAM}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
    }}
    """

    results = []
    diagram_part_links = {}

    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
        }
        results.append(entity)

    # Extract hasDiagramPart links
    part_query = f"""
    PREFIX sdm: <{config.SDM}>

    SELECT DISTINCT ?diagram ?part
    WHERE {{
        ?diagram a <{config.TYPE_CAUSAL_DIAGRAM}> .
        ?diagram sdm:hasDiagramPart ?part .
    }}
    """

    for row in ds.query(part_query):
        diagram_id = str(row.diagram)
        part_id = str(row.part)
        if diagram_id not in diagram_part_links:
            diagram_part_links[diagram_id] = []
        diagram_part_links[diagram_id].append(part_id)

    print(f"Extracted {len(results)} CausalDiagram entities")
    return results, diagram_part_links


def extract_images(ds: Graph) -> List[Dict[str, Any]]:
    """Extract Image entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description
    WHERE {{
        ?id a <{config.TYPE_IMAGE}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
    }}
    """

    results = []
    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
        }
        results.append(entity)

    print(f"Extracted {len(results)} Image entities")
    return results


def extract_variable_presentations(ds: Graph) -> List[Dict[str, Any]]:
    """Extract VariablePresentation entities."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?has_long_name ?has_short_name
                    ?has_standard_variable ?uses_unit
    WHERE {{
        ?id a <{config.TYPE_VARIABLE_PRESENTATION}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:hasLongName ?has_long_name }}
        OPTIONAL {{ ?id sd:hasShortName ?has_short_name }}
        OPTIONAL {{ ?id sd:hasStandardVariable ?has_standard_variable }}
        OPTIONAL {{ ?id sd:usesUnit ?uses_unit }}
    }}
    """

    results = []
    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
            'has_long_name': str(row.has_long_name) if row.has_long_name else None,
            'has_short_name': str(row.has_short_name) if row.has_short_name else None,
            'has_standard_variable': str(row.has_standard_variable) if row.has_standard_variable else None,
            'uses_unit': str(row.uses_unit) if row.uses_unit else None,
        }
        results.append(entity)

    print(f"Extracted {len(results)} VariablePresentation entities")
    return results


def extract_interventions(ds: Graph) -> List[Dict[str, Any]]:
    """Extract Intervention entities."""
    query = f"""
    PREFIX sdm: <{config.SDM}>
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description
    WHERE {{
        ?id a <{config.TYPE_INTERVENTION}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
    }}
    """

    results = []
    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
        }
        results.append(entity)

    print(f"Extracted {len(results)} Intervention entities")
    return results


def extract_grids(ds: Graph) -> List[Dict[str, Any]]:
    """Extract Grid entities."""
    query = f"""
    PREFIX sdm: <{config.SDM}>
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label ?description ?has_dimension ?has_shape
                    ?has_spatial_resolution ?has_coordinate_system ?grid_type
    WHERE {{
        ?id a <{config.TYPE_GRID}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id sd:hasDimension ?has_dimension }}
        OPTIONAL {{ ?id sdm:hasShape ?has_shape }}
        OPTIONAL {{ ?id sdm:hasSpatialResolution ?has_spatial_resolution }}
        OPTIONAL {{ ?id sdm:hasCoordinateSystem ?has_coordinate_system }}
        OPTIONAL {{ ?id sdm:gridType ?grid_type }}
    }}
    """

    results = []
    for row in ds.query(query):
        entity = {
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
            'description': str(row.description) if row.description else None,
            'has_dimension': str(row.has_dimension) if row.has_dimension else None,
            'has_shape': str(row.has_shape) if row.has_shape else None,
            'has_spatial_resolution': str(row.has_spatial_resolution) if row.has_spatial_resolution else None,
            'has_coordinate_system': str(row.has_coordinate_system) if row.has_coordinate_system else None,
            'grid_type': str(row.grid_type) if row.grid_type else None,
        }
        results.append(entity)

    print(f"Extracted {len(results)} Grid entities")
    return results


def extract_standard_variables(ds: Graph) -> List[Dict[str, Any]]:
    """Extract StandardVariable entities (D-01, D-09)."""
    query = f"""
    PREFIX sd: <{config.SD}>
    PREFIX rdfs: <{config.RDFS}>
    PREFIX owl: <{config.OWL}>

    SELECT DISTINCT ?id ?label ?description ?sameAs
    WHERE {{
        ?id a <{config.TYPE_STANDARD_VARIABLE}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
        OPTIONAL {{ ?id sd:description ?description }}
        OPTIONAL {{ ?id owl:sameAs ?sameAs }}
    }}
    """
    # Group by id since sameAs can be multi-valued
    grouped = {}
    for row in ds.query(query):
        sv_id = str(row.id)
        if sv_id not in grouped:
            grouped[sv_id] = {
                'id': sv_id,
                'label': str(row.label) if row.label else None,
                'description': str(row.description) if row.description else None,
                'same_as': [],
            }
        if row.sameAs:
            grouped[sv_id]['same_as'].append(str(row.sameAs))

    results = list(grouped.values())
    # Convert empty lists to None for cleaner DB storage
    for r in results:
        if not r['same_as']:
            r['same_as'] = None
    print(f"Extracted {len(results)} StandardVariable entities")
    return results


def extract_units(ds: Graph) -> List[Dict[str, Any]]:
    """Extract Unit entities typed as qudt:Unit (D-02, D-09)."""
    query = f"""
    PREFIX rdfs: <{config.RDFS}>

    SELECT DISTINCT ?id ?label
    WHERE {{
        ?id a <{config.TYPE_UNIT}> .
        OPTIONAL {{ ?id rdfs:label ?label }}
    }}
    """
    results = []
    for row in ds.query(query):
        results.append({
            'id': str(row.id),
            'label': str(row.label) if row.label else None,
        })
    print(f"Extracted {len(results)} Unit entities")
    return results


def diagnose_junction_sparsity(ds: Graph):
    """Diagnose variable junction table sparsity (D-04).
    Counts actual relationship triples in TriG to determine if sparsity
    is a data issue or ETL bug."""
    predicates = {
        'hasInputVariable': f"{config.SDM}hasInputVariable",
        'hasOutputVariable': f"{config.SDM}hasOutputVariable",
        'calibratedVariable': f"{config.SDM}calibratedVariable",
        'calibrationTargetVariable': f"{config.SDM}calibrationTargetVariable",
    }
    print("\n=== Junction Sparsity Diagnostic (D-04) ===")
    for name, uri in predicates.items():
        query = f"""
        SELECT (COUNT(*) AS ?count)
        WHERE {{
            ?subject <{uri}> ?object .
        }}
        """
        result = list(ds.query(query))
        count = int(result[0][0])
        print(f"  {name}: {count} triples in TriG")
    print("=== End Diagnostic ===\n")


def extract_all(trig_path: str) -> Dict[str, Any]:
    """Extract all entities from the TriG file."""
    ds = load_dataset(trig_path)

    # Extract original entities
    software, version_links, software_author_links, software_category_links = extract_software(ds)
    software_versions, version_link_dicts = extract_software_versions(ds)
    model_configurations, config_link_dicts = extract_model_configurations(ds)
    model_configuration_setups, setup_link_dicts = extract_model_configuration_setups(ds)
    dataset_specifications, dsi_presentation_links = extract_dataset_specifications(ds)
    parameters, param_intervention_links, param_adjusts_variable_links = extract_parameters(ds)

    # Extract new entities
    persons = extract_persons(ds)
    model_categories, category_parent_links = extract_model_categories(ds)
    regions, region_part_of_links = extract_regions(ds)
    processes = extract_processes(ds)
    time_intervals = extract_time_intervals(ds)
    causal_diagrams, diagram_part_links = extract_causal_diagrams(ds)
    images = extract_images(ds)
    variable_presentations = extract_variable_presentations(ds)
    interventions = extract_interventions(ds)
    grids = extract_grids(ds)
    standard_variables = extract_standard_variables(ds)
    units = extract_units(ds)

    # Run junction sparsity diagnostic (D-04)
    diagnose_junction_sparsity(ds)

    return {
        # Original entities
        'software': software,
        'software_versions': software_versions,
        'model_configurations': model_configurations,
        'model_configuration_setups': model_configuration_setups,
        'dataset_specifications': dataset_specifications,
        'parameters': parameters,
        # New entities
        'persons': persons,
        'model_categories': model_categories,
        'regions': regions,
        'processes': processes,
        'time_intervals': time_intervals,
        'causal_diagrams': causal_diagrams,
        'images': images,
        'variable_presentations': variable_presentations,
        'interventions': interventions,
        'grids': grids,
        'standard_variables': standard_variables,
        'units': units,
        # All links
        'links': {
            # Original links
            'software_to_version': version_links,
            'software_to_author': software_author_links,
            'software_to_category': software_category_links,
            'version_to_author': version_link_dicts.get('author', {}),
            'config_to_author': config_link_dicts.get('author', {}),
            'version_to_configuration': version_link_dicts.get('configuration', {}),
            'configuration': config_link_dicts,
            'setup': setup_link_dicts,
            # New SoftwareVersion links
            'version_to_category': version_link_dicts.get('category', {}),
            'version_to_process': version_link_dicts.get('process', {}),
            'version_to_grid': version_link_dicts.get('grid', {}),
            'version_to_image': version_link_dicts.get('image', {}),
            'version_to_input_variable': version_link_dicts.get('input_variable', {}),
            'version_to_output_variable': version_link_dicts.get('output_variable', {}),
            # New ModelConfiguration links
            'config_to_causal_diagram': config_link_dicts.get('causal_diagram', {}),
            'config_to_time_interval': config_link_dicts.get('time_interval', {}),
            'config_to_region': config_link_dicts.get('region', {}),
            'mc_to_category': config_link_dicts.get('category', {}),
            # New ModelConfigurationSetup links
            'setup_to_author': setup_link_dicts.get('author', {}),
            'setup_to_calibrated_variable': setup_link_dicts.get('calibrated_variable', {}),
            'setup_to_calibration_target': setup_link_dicts.get('calibration_target', {}),
            'mcs_to_category': setup_link_dicts.get('category', {}),
            # Parameter links
            'param_to_intervention': param_intervention_links,
            'param_to_adjusts_variable': param_adjusts_variable_links,
            # DatasetSpecification links
            'dsi_to_presentation': dsi_presentation_links,
            # Self-referential links
            'category_parent': category_parent_links,
            'region_part_of': region_part_of_links,
            # Polymorphic links
            'diagram_to_part': diagram_part_links,
        }
    }
