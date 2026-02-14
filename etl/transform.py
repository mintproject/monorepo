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
    """
    links = extracted_data['links']

    # Configuration junction tables
    config_input_rows = []
    config_output_rows = []
    config_parameter_rows = []

    for config_id, input_ids in links['configuration']['input'].items():
        for input_id in input_ids:
            config_input_rows.append({
                'configuration_id': config_id,
                'input_id': input_id,
            })

    for config_id, output_ids in links['configuration']['output'].items():
        for output_id in output_ids:
            config_output_rows.append({
                'configuration_id': config_id,
                'output_id': output_id,
            })

    for config_id, param_ids in links['configuration']['parameter'].items():
        for param_id in param_ids:
            config_parameter_rows.append({
                'configuration_id': config_id,
                'parameter_id': param_id,
            })

    # Setup junction tables
    setup_input_rows = []
    setup_output_rows = []
    setup_parameter_rows = []

    for setup_id, input_ids in links['setup']['input'].items():
        for input_id in input_ids:
            setup_input_rows.append({
                'setup_id': setup_id,
                'input_id': input_id,
            })

    for setup_id, output_ids in links['setup']['output'].items():
        for output_id in output_ids:
            setup_output_rows.append({
                'setup_id': setup_id,
                'output_id': output_id,
            })

    for setup_id, param_ids in links['setup']['parameter'].items():
        for param_id in param_ids:
            setup_parameter_rows.append({
                'setup_id': setup_id,
                'parameter_id': param_id,
            })

    print(f"Built junction tables:")
    print(f"  - configuration_input: {len(config_input_rows)} rows")
    print(f"  - configuration_output: {len(config_output_rows)} rows")
    print(f"  - configuration_parameter: {len(config_parameter_rows)} rows")
    print(f"  - setup_input: {len(setup_input_rows)} rows")
    print(f"  - setup_output: {len(setup_output_rows)} rows")
    print(f"  - setup_parameter: {len(setup_parameter_rows)} rows")

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

    # Deduplicate entities
    extracted_data['software'] = deduplicate_by_id(extracted_data['software'])
    extracted_data['software_versions'] = deduplicate_by_id(extracted_data['software_versions'])
    extracted_data['model_configurations'] = deduplicate_by_id(extracted_data['model_configurations'])
    extracted_data['model_configuration_setups'] = deduplicate_by_id(extracted_data['model_configuration_setups'])
    extracted_data['dataset_specifications'] = deduplicate_by_id(extracted_data['dataset_specifications'])
    extracted_data['parameters'] = deduplicate_by_id(extracted_data['parameters'])

    # Invert FK relationships
    transformed = invert_fk_relationships(extracted_data)

    # Build junction table rows
    junction_tables = build_junction_tables(extracted_data)

    # Combine entity tables and junction tables
    result = {
        'modelcatalog_software': transformed['software'],
        'modelcatalog_software_version': transformed['software_versions'],
        'modelcatalog_model_configuration': transformed['model_configurations'],
        'modelcatalog_model_configuration_setup': transformed['model_configuration_setups'],
        'modelcatalog_dataset_specification': transformed['dataset_specifications'],
        'modelcatalog_parameter': transformed['parameters'],
    }

    result.update(junction_tables)

    print(f"Transformation complete:")
    print(f"  - software: {len(result['modelcatalog_software'])} rows")
    print(f"  - software_version: {len(result['modelcatalog_software_version'])} rows")
    print(f"  - model_configuration: {len(result['modelcatalog_model_configuration'])} rows")
    print(f"  - model_configuration_setup: {len(result['modelcatalog_model_configuration_setup'])} rows")
    print(f"  - dataset_specification: {len(result['modelcatalog_dataset_specification'])} rows")
    print(f"  - parameter: {len(result['modelcatalog_parameter'])} rows")

    if transformed['orphan_counts']['software_versions'] > 0:
        print(f"  - WARNING: {transformed['orphan_counts']['software_versions']} orphaned software_versions")
    if transformed['orphan_counts']['model_configurations'] > 0:
        print(f"  - WARNING: {transformed['orphan_counts']['model_configurations']} orphaned model_configurations")
    if transformed['orphan_counts']['model_configuration_setups'] > 0:
        print(f"  - WARNING: {transformed['orphan_counts']['model_configuration_setups']} orphaned model_configuration_setups")

    return result
