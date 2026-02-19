"""
Transform extracted RDF data into relational rows with proper FK relationships.
"""
from typing import Dict, List, Any, Set


def deduplicate_by_id(entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicate entities by ID (first occurrence wins)."""
    seen: Set[str] = set()
    result = []
    for entity in entities:
        entity_id = entity['id']
        if entity_id not in seen:
            seen.add(entity_id)
            result.append(entity)
    return result


def ensure_labels(entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Ensure all entities have a label value.
    If label is None or empty, derive it from the URI.
    """
    for entity in entities:
        if not entity.get('label'):
            # Extract last segment of URI as label
            uri = entity['id']
            if '/' in uri:
                label = uri.rsplit('/', 1)[-1]
            elif '#' in uri:
                label = uri.rsplit('#', 1)[-1]
            else:
                label = uri

            # Decode URL encoding if present
            import urllib.parse
            label = urllib.parse.unquote(label)

            entity['label'] = label

    return entities


def invert_fk_relationships(extracted_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Invert parent-child relationships into FK columns.

    TriG has: Software --hasVersion--> SoftwareVersion
    DB needs: SoftwareVersion.software_id -> Software.id
    """
    software = extracted_data['software']
    software_versions = extracted_data['software_versions']
    model_configurations = extracted_data['model_configurations']
    model_configuration_setups = extracted_data['model_configuration_setups']

    links = extracted_data['links']

    # Build reverse lookup for software_version.software_id
    version_to_software = {}
    for software_id, version_ids in links['software_to_version'].items():
        for version_id in version_ids:
            version_to_software[version_id] = software_id

    # Build reverse lookup for configuration.software_version_id
    config_to_version = {}
    for version_id, config_ids in links['version_to_configuration'].items():
        for config_id in config_ids:
            config_to_version[config_id] = version_id

    # Build reverse lookup for setup.model_configuration_id
    setup_to_config = {}
    for config_id, setup_ids in links['configuration']['setup'].items():
        for setup_id in setup_ids:
            setup_to_config[setup_id] = config_id

    # Apply FK columns to software_versions
    orphaned_versions = []
    for version in software_versions:
        version_id = version['id']
        if version_id in version_to_software:
            version['software_id'] = version_to_software[version_id]
        else:
            version['software_id'] = None
            orphaned_versions.append(version_id)

    if orphaned_versions:
        print(f"WARNING: {len(orphaned_versions)} SoftwareVersions have no parent Software")

    # Apply FK columns to model_configurations
    orphaned_configs = []
    for config in model_configurations:
        config_id = config['id']
        if config_id in config_to_version:
            config['software_version_id'] = config_to_version[config_id]
        else:
            config['software_version_id'] = None
            orphaned_configs.append(config_id)

    if orphaned_configs:
        print(f"WARNING: {len(orphaned_configs)} ModelConfigurations have no parent SoftwareVersion")

    # Apply FK columns to model_configuration_setups
    orphaned_setups = []
    for setup in model_configuration_setups:
        setup_id = setup['id']
        if setup_id in setup_to_config:
            setup['model_configuration_id'] = setup_to_config[setup_id]
        else:
            setup['model_configuration_id'] = None
            orphaned_setups.append(setup_id)

    if orphaned_setups:
        print(f"WARNING: {len(orphaned_setups)} ModelConfigurationSetups have no parent ModelConfiguration")

    return {
        'software': software,
        'software_versions': software_versions,
        'model_configurations': model_configurations,
        'model_configuration_setups': model_configuration_setups,
        'dataset_specifications': extracted_data['dataset_specifications'],
        'parameters': extracted_data['parameters'],
        'orphan_counts': {
            'software_versions': len(orphaned_versions),
            'model_configurations': len(orphaned_configs),
            'model_configuration_setups': len(orphaned_setups),
        }
    }


def build_junction_tables(extracted_data: Dict[str, Any]) -> Dict[str, List[Dict[str, str]]]:
    """
    Build junction table rows from hasInput/hasOutput/hasParameter links.
    Only include references to entities that exist in our extracted data.
    """
    links = extracted_data['links']

    # Build sets of valid IDs for FK validation
    valid_dataset_ids = {e['id'] for e in extracted_data['dataset_specifications']}
    valid_parameter_ids = {e['id'] for e in extracted_data['parameters']}

    # Configuration junction tables
    config_input_rows = []
    config_output_rows = []
    config_parameter_rows = []

    skipped_config_inputs = 0
    skipped_config_outputs = 0
    skipped_config_params = 0

    for config_id, input_ids in links['configuration']['input'].items():
        for input_id in input_ids:
            if input_id in valid_dataset_ids:
                config_input_rows.append({
                    'configuration_id': config_id,
                    'input_id': input_id,
                })
            else:
                skipped_config_inputs += 1

    for config_id, output_ids in links['configuration']['output'].items():
        for output_id in output_ids:
            if output_id in valid_dataset_ids:
                config_output_rows.append({
                    'configuration_id': config_id,
                    'output_id': output_id,
                })
            else:
                skipped_config_outputs += 1

    for config_id, param_ids in links['configuration']['parameter'].items():
        for param_id in param_ids:
            if param_id in valid_parameter_ids:
                config_parameter_rows.append({
                    'configuration_id': config_id,
                    'parameter_id': param_id,
                })
            else:
                skipped_config_params += 1

    # Setup junction tables
    setup_input_rows = []
    setup_output_rows = []
    setup_parameter_rows = []

    skipped_setup_inputs = 0
    skipped_setup_outputs = 0
    skipped_setup_params = 0

    for setup_id, input_ids in links['setup']['input'].items():
        for input_id in input_ids:
            if input_id in valid_dataset_ids:
                setup_input_rows.append({
                    'setup_id': setup_id,
                    'input_id': input_id,
                })
            else:
                skipped_setup_inputs += 1

    for setup_id, output_ids in links['setup']['output'].items():
        for output_id in output_ids:
            if output_id in valid_dataset_ids:
                setup_output_rows.append({
                    'setup_id': setup_id,
                    'output_id': output_id,
                })
            else:
                skipped_setup_outputs += 1

    for setup_id, param_ids in links['setup']['parameter'].items():
        for param_id in param_ids:
            if param_id in valid_parameter_ids:
                setup_parameter_rows.append({
                    'setup_id': setup_id,
                    'parameter_id': param_id,
                })
            else:
                skipped_setup_params += 1

    print(f"Built junction tables:")
    print(f"  - configuration_input: {len(config_input_rows)} rows")
    print(f"  - configuration_output: {len(config_output_rows)} rows")
    print(f"  - configuration_parameter: {len(config_parameter_rows)} rows")
    print(f"  - setup_input: {len(setup_input_rows)} rows")
    print(f"  - setup_output: {len(setup_output_rows)} rows")
    print(f"  - setup_parameter: {len(setup_parameter_rows)} rows")

    total_skipped = (skipped_config_inputs + skipped_config_outputs + skipped_config_params +
                     skipped_setup_inputs + skipped_setup_outputs + skipped_setup_params)
    if total_skipped > 0:
        print(f"  - Skipped {total_skipped} junction rows referencing missing entities")

    return {
        'modelcatalog_configuration_input': config_input_rows,
        'modelcatalog_configuration_output': config_output_rows,
        'modelcatalog_configuration_parameter': config_parameter_rows,
        'modelcatalog_setup_input': setup_input_rows,
        'modelcatalog_setup_output': setup_output_rows,
        'modelcatalog_setup_parameter': setup_parameter_rows,
    }


def transform_all(extracted_data: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Transform extracted RDF data into load-ready relational data.
    """
    print("Transforming extracted data...")

    # Deduplicate entities (original 6)
    extracted_data['software'] = deduplicate_by_id(extracted_data['software'])
    extracted_data['software_versions'] = deduplicate_by_id(extracted_data['software_versions'])
    extracted_data['model_configurations'] = deduplicate_by_id(extracted_data['model_configurations'])
    extracted_data['model_configuration_setups'] = deduplicate_by_id(extracted_data['model_configuration_setups'])
    extracted_data['dataset_specifications'] = deduplicate_by_id(extracted_data['dataset_specifications'])
    extracted_data['parameters'] = deduplicate_by_id(extracted_data['parameters'])

    # Deduplicate new entities (10 new types)
    extracted_data['persons'] = deduplicate_by_id(extracted_data['persons'])
    extracted_data['model_categories'] = deduplicate_by_id(extracted_data['model_categories'])
    extracted_data['regions'] = deduplicate_by_id(extracted_data['regions'])
    extracted_data['processes'] = deduplicate_by_id(extracted_data['processes'])
    extracted_data['time_intervals'] = deduplicate_by_id(extracted_data['time_intervals'])
    extracted_data['causal_diagrams'] = deduplicate_by_id(extracted_data['causal_diagrams'])
    extracted_data['images'] = deduplicate_by_id(extracted_data['images'])
    extracted_data['variable_presentations'] = deduplicate_by_id(extracted_data['variable_presentations'])
    extracted_data['interventions'] = deduplicate_by_id(extracted_data['interventions'])
    extracted_data['grids'] = deduplicate_by_id(extracted_data['grids'])

    # Ensure all entities have labels (required by schema NOT NULL constraint)
    extracted_data['software'] = ensure_labels(extracted_data['software'])
    extracted_data['software_versions'] = ensure_labels(extracted_data['software_versions'])
    extracted_data['model_configurations'] = ensure_labels(extracted_data['model_configurations'])
    extracted_data['model_configuration_setups'] = ensure_labels(extracted_data['model_configuration_setups'])
    extracted_data['dataset_specifications'] = ensure_labels(extracted_data['dataset_specifications'])
    extracted_data['parameters'] = ensure_labels(extracted_data['parameters'])

    # Ensure labels for new entities
    extracted_data['persons'] = ensure_labels(extracted_data['persons'])
    extracted_data['model_categories'] = ensure_labels(extracted_data['model_categories'])
    extracted_data['regions'] = ensure_labels(extracted_data['regions'])
    extracted_data['processes'] = ensure_labels(extracted_data['processes'])
    extracted_data['time_intervals'] = ensure_labels(extracted_data['time_intervals'])
    extracted_data['causal_diagrams'] = ensure_labels(extracted_data['causal_diagrams'])
    extracted_data['images'] = ensure_labels(extracted_data['images'])
    extracted_data['variable_presentations'] = ensure_labels(extracted_data['variable_presentations'])
    extracted_data['interventions'] = ensure_labels(extracted_data['interventions'])
    extracted_data['grids'] = ensure_labels(extracted_data['grids'])

    # Invert FK relationships
    transformed = invert_fk_relationships(extracted_data)

    # Resolve self-referential FKs for hierarchical entities
    links = extracted_data['links']

    # Build valid ID sets for FK validation
    valid_category_ids = {e['id'] for e in extracted_data['model_categories']}
    valid_region_ids = {e['id'] for e in extracted_data['regions']}

    # ModelCategory: parent_category_id
    category_parent_links = links.get('category_parent', {})
    for category in extracted_data['model_categories']:
        category_id = category['id']
        if category_id in category_parent_links:
            parent_id = category_parent_links[category_id]
            # Only set FK if parent exists in extracted data
            if parent_id in valid_category_ids:
                category['parent_category_id'] = parent_id
            else:
                category['parent_category_id'] = None
        else:
            category['parent_category_id'] = None

    # Region: part_of_id
    region_part_of_links = links.get('region_part_of', {})
    for region in extracted_data['regions']:
        region_id = region['id']
        if region_id in region_part_of_links:
            part_of_id = region_part_of_links[region_id]
            # Only set FK if parent exists in extracted data
            if part_of_id in valid_region_ids:
                region['part_of_id'] = part_of_id
            else:
                region['part_of_id'] = None
        else:
            region['part_of_id'] = None

    # Build junction table rows (original 6)
    junction_tables = build_junction_tables(extracted_data)

    # Combine entity tables and junction tables
    result = {
        # Original 6 entity types
        'modelcatalog_software': transformed['software'],
        'modelcatalog_software_version': transformed['software_versions'],
        'modelcatalog_model_configuration': transformed['model_configurations'],
        'modelcatalog_model_configuration_setup': transformed['model_configuration_setups'],
        'modelcatalog_dataset_specification': transformed['dataset_specifications'],
        'modelcatalog_parameter': transformed['parameters'],
        # 10 new entity types
        'modelcatalog_person': extracted_data['persons'],
        'modelcatalog_model_category': extracted_data['model_categories'],
        'modelcatalog_region': extracted_data['regions'],
        'modelcatalog_process': extracted_data['processes'],
        'modelcatalog_time_interval': extracted_data['time_intervals'],
        'modelcatalog_causal_diagram': extracted_data['causal_diagrams'],
        'modelcatalog_image': extracted_data['images'],
        'modelcatalog_variable_presentation': extracted_data['variable_presentations'],
        'modelcatalog_intervention': extracted_data['interventions'],
        'modelcatalog_grid': extracted_data['grids'],
    }

    result.update(junction_tables)

    print(f"Transformation complete:")
    print(f"  - software: {len(result['modelcatalog_software'])} rows")
    print(f"  - software_version: {len(result['modelcatalog_software_version'])} rows")
    print(f"  - model_configuration: {len(result['modelcatalog_model_configuration'])} rows")
    print(f"  - model_configuration_setup: {len(result['modelcatalog_model_configuration_setup'])} rows")
    print(f"  - dataset_specification: {len(result['modelcatalog_dataset_specification'])} rows")
    print(f"  - parameter: {len(result['modelcatalog_parameter'])} rows")
    print(f"  - person: {len(result['modelcatalog_person'])} rows")
    print(f"  - model_category: {len(result['modelcatalog_model_category'])} rows")
    print(f"  - region: {len(result['modelcatalog_region'])} rows")
    print(f"  - process: {len(result['modelcatalog_process'])} rows")
    print(f"  - time_interval: {len(result['modelcatalog_time_interval'])} rows")
    print(f"  - causal_diagram: {len(result['modelcatalog_causal_diagram'])} rows")
    print(f"  - image: {len(result['modelcatalog_image'])} rows")
    print(f"  - variable_presentation: {len(result['modelcatalog_variable_presentation'])} rows")
    print(f"  - intervention: {len(result['modelcatalog_intervention'])} rows")
    print(f"  - grid: {len(result['modelcatalog_grid'])} rows")

    if transformed['orphan_counts']['software_versions'] > 0:
        print(f"  - WARNING: {transformed['orphan_counts']['software_versions']} orphaned software_versions")
    if transformed['orphan_counts']['model_configurations'] > 0:
        print(f"  - WARNING: {transformed['orphan_counts']['model_configurations']} orphaned model_configurations")
    if transformed['orphan_counts']['model_configuration_setups'] > 0:
        print(f"  - WARNING: {transformed['orphan_counts']['model_configuration_setups']} orphaned model_configuration_setups")

    return result
