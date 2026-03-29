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


def build_extended_junction_tables(extracted_data: Dict[str, Any]) -> Dict[str, List[Dict[str, str]]]:
    """
    Build 14 new junction table rows with FK validation.
    Only include references to entities that exist in our extracted data.
    """
    links = extracted_data['links']

    # Build sets of valid IDs for FK validation (new entity types)
    valid_person_ids = {e['id'] for e in extracted_data['persons']}
    valid_category_ids = {e['id'] for e in extracted_data['model_categories']}
    valid_region_ids = {e['id'] for e in extracted_data['regions']}
    valid_process_ids = {e['id'] for e in extracted_data['processes']}
    valid_time_interval_ids = {e['id'] for e in extracted_data['time_intervals']}
    valid_causal_diagram_ids = {e['id'] for e in extracted_data['causal_diagrams']}
    valid_image_ids = {e['id'] for e in extracted_data['images']}
    valid_variable_ids = {e['id'] for e in extracted_data['variable_presentations']}
    valid_intervention_ids = {e['id'] for e in extracted_data['interventions']}
    valid_grid_ids = {e['id'] for e in extracted_data['grids']}

    # Also need valid IDs for existing entity types (for FK validation)
    valid_software_ids = {e['id'] for e in extracted_data['software']}
    valid_software_version_ids = {e['id'] for e in extracted_data['software_versions']}
    valid_configuration_ids = {e['id'] for e in extracted_data['model_configurations']}
    valid_setup_ids = {e['id'] for e in extracted_data['model_configuration_setups']}
    valid_parameter_ids = {e['id'] for e in extracted_data['parameters']}

    # Software author junction table
    software_author_rows = []
    for sw_id, author_ids in links.get('software_to_author', {}).items():
        if sw_id not in valid_software_ids:
            continue
        for author_id in author_ids:
            if author_id in valid_person_ids:
                software_author_rows.append({
                    'software_id': sw_id,
                    'person_id': author_id,
                })

    # SoftwareVersion author junction table
    version_author_rows = []
    for ver_id, author_ids in links.get('version_to_author', {}).items():
        if ver_id not in valid_software_version_ids:
            continue
        for author_id in author_ids:
            if author_id in valid_person_ids:
                version_author_rows.append({
                    'software_version_id': ver_id,
                    'person_id': author_id,
                })

    # ModelConfiguration author junction table
    configuration_author_rows = []
    for cfg_id, author_ids in links.get('config_to_author', {}).items():
        if cfg_id not in valid_configuration_ids:
            continue
        for author_id in author_ids:
            if author_id in valid_person_ids:
                configuration_author_rows.append({
                    'configuration_id': cfg_id,
                    'person_id': author_id,
                })

    # SoftwareVersion junction tables (6)
    version_category_rows = []
    version_process_rows = []
    version_grid_rows = []
    version_image_rows = []
    version_input_variable_rows = []
    version_output_variable_rows = []

    skipped_version_category = 0
    skipped_version_process = 0
    skipped_version_grid = 0
    skipped_version_image = 0
    skipped_version_input_variable = 0
    skipped_version_output_variable = 0

    # Build software_version_category junction
    for version_id, category_ids in links.get('version_to_category', {}).items():
        if version_id not in valid_software_version_ids:
            continue
        for category_id in category_ids:
            if category_id in valid_category_ids:
                version_category_rows.append({
                    'software_version_id': version_id,
                    'category_id': category_id,
                })
            else:
                skipped_version_category += 1

    # Build software_category junction
    software_category_rows = []
    skipped_software_category = 0
    for software_id, category_ids in links.get('software_to_category', {}).items():
        if software_id not in valid_software_ids:
            continue
        for category_id in category_ids:
            if category_id in valid_category_ids:
                software_category_rows.append({
                    'software_id': software_id,
                    'category_id': category_id,
                })
            else:
                skipped_software_category += 1

    # Build modelconfiguration_category junction
    mc_category_rows = []
    skipped_mc_category = 0
    for mc_id, category_ids in links.get('mc_to_category', {}).items():
        if mc_id not in valid_configuration_ids:
            continue
        for category_id in category_ids:
            if category_id in valid_category_ids:
                mc_category_rows.append({
                    'model_configuration_id': mc_id,
                    'category_id': category_id,
                })
            else:
                skipped_mc_category += 1

    # Build modelconfigurationsetup_category junction
    mcs_category_rows = []
    skipped_mcs_category = 0
    for mcs_id, category_ids in links.get('mcs_to_category', {}).items():
        if mcs_id not in valid_setup_ids:
            continue
        for category_id in category_ids:
            if category_id in valid_category_ids:
                mcs_category_rows.append({
                    'model_configuration_setup_id': mcs_id,
                    'category_id': category_id,
                })
            else:
                skipped_mcs_category += 1

    # Build software_version_process junction
    for version_id, process_ids in links.get('version_to_process', {}).items():
        if version_id not in valid_software_version_ids:
            continue
        for process_id in process_ids:
            if process_id in valid_process_ids:
                version_process_rows.append({
                    'software_version_id': version_id,
                    'process_id': process_id,
                })
            else:
                skipped_version_process += 1

    # Build software_version_grid junction
    for version_id, grid_ids in links.get('version_to_grid', {}).items():
        if version_id not in valid_software_version_ids:
            continue
        for grid_id in grid_ids:
            if grid_id in valid_grid_ids:
                version_grid_rows.append({
                    'software_version_id': version_id,
                    'grid_id': grid_id,
                })
            else:
                skipped_version_grid += 1

    # Build software_version_image junction
    for version_id, image_ids in links.get('version_to_image', {}).items():
        if version_id not in valid_software_version_ids:
            continue
        for image_id in image_ids:
            if image_id in valid_image_ids:
                version_image_rows.append({
                    'software_version_id': version_id,
                    'image_id': image_id,
                })
            else:
                skipped_version_image += 1

    # Build software_version_input_variable junction
    for version_id, variable_ids in links.get('version_to_input_variable', {}).items():
        if version_id not in valid_software_version_ids:
            continue
        for variable_id in variable_ids:
            if variable_id in valid_variable_ids:
                version_input_variable_rows.append({
                    'software_version_id': version_id,
                    'variable_id': variable_id,
                })
            else:
                skipped_version_input_variable += 1

    # Build software_version_output_variable junction
    for version_id, variable_ids in links.get('version_to_output_variable', {}).items():
        if version_id not in valid_software_version_ids:
            continue
        for variable_id in variable_ids:
            if variable_id in valid_variable_ids:
                version_output_variable_rows.append({
                    'software_version_id': version_id,
                    'variable_id': variable_id,
                })
            else:
                skipped_version_output_variable += 1

    # Configuration junction tables (3)
    config_causal_diagram_rows = []
    config_time_interval_rows = []
    config_region_rows = []

    skipped_config_causal = 0
    skipped_config_time = 0
    skipped_config_region = 0

    # Build configuration_causal_diagram junction
    for config_id, diagram_ids in links.get('config_to_causal_diagram', {}).items():
        if config_id not in valid_configuration_ids:
            continue
        for diagram_id in diagram_ids:
            if diagram_id in valid_causal_diagram_ids:
                config_causal_diagram_rows.append({
                    'configuration_id': config_id,
                    'causal_diagram_id': diagram_id,
                })
            else:
                skipped_config_causal += 1

    # Build configuration_time_interval junction
    for config_id, time_ids in links.get('config_to_time_interval', {}).items():
        if config_id not in valid_configuration_ids:
            continue
        for time_id in time_ids:
            if time_id in valid_time_interval_ids:
                config_time_interval_rows.append({
                    'configuration_id': config_id,
                    'time_interval_id': time_id,
                })
            else:
                skipped_config_time += 1

    # Build configuration_region junction
    for config_id, region_ids in links.get('config_to_region', {}).items():
        if config_id not in valid_configuration_ids:
            continue
        for region_id in region_ids:
            if region_id in valid_region_ids:
                config_region_rows.append({
                    'configuration_id': config_id,
                    'region_id': region_id,
                })
            else:
                skipped_config_region += 1

    # Setup junction tables (3)
    setup_author_rows = []
    setup_calibrated_variable_rows = []
    setup_calibration_target_rows = []

    skipped_setup_author = 0
    skipped_setup_calibrated = 0
    skipped_setup_target = 0

    # Build setup_author junction
    for setup_id, author_ids in links.get('setup_to_author', {}).items():
        if setup_id not in valid_setup_ids:
            continue
        for author_id in author_ids:
            if author_id in valid_person_ids:
                setup_author_rows.append({
                    'setup_id': setup_id,
                    'person_id': author_id,
                })
            else:
                skipped_setup_author += 1

    # Build setup_calibrated_variable junction
    for setup_id, variable_ids in links.get('setup_to_calibrated_variable', {}).items():
        if setup_id not in valid_setup_ids:
            continue
        for variable_id in variable_ids:
            if variable_id in valid_variable_ids:
                setup_calibrated_variable_rows.append({
                    'setup_id': setup_id,
                    'variable_id': variable_id,
                })
            else:
                skipped_setup_calibrated += 1

    # Build setup_calibration_target junction
    for setup_id, variable_ids in links.get('setup_to_calibration_target', {}).items():
        if setup_id not in valid_setup_ids:
            continue
        for variable_id in variable_ids:
            if variable_id in valid_variable_ids:
                setup_calibration_target_rows.append({
                    'setup_id': setup_id,
                    'variable_id': variable_id,
                })
            else:
                skipped_setup_target += 1

    # Parameter junction table (1)
    parameter_intervention_rows = []
    skipped_param_intervention = 0

    # Build parameter_intervention junction
    for param_id, intervention_ids in links.get('param_to_intervention', {}).items():
        if param_id not in valid_parameter_ids:
            continue
        for intervention_id in intervention_ids:
            if intervention_id in valid_intervention_ids:
                parameter_intervention_rows.append({
                    'parameter_id': param_id,
                    'intervention_id': intervention_id,
                })
            else:
                skipped_param_intervention += 1

    # DatasetSpecification junction table (1)
    dsi_presentation_rows = []
    skipped_dsi_presentation = 0

    valid_dataset_spec_ids = {e['id'] for e in extracted_data['dataset_specifications']}

    # Build dataset_specification_presentation junction
    for dsi_id, pres_ids in links.get('dsi_to_presentation', {}).items():
        if dsi_id not in valid_dataset_spec_ids:
            continue
        for pres_id in pres_ids:
            if pres_id in valid_variable_ids:
                dsi_presentation_rows.append({
                    'dataset_specification_id': dsi_id,
                    'presentation_id': pres_id,
                })
            else:
                skipped_dsi_presentation += 1

    # CausalDiagram polymorphic junction table (1)
    diagram_part_rows = []
    skipped_diagram_part = 0

    # Build diagram_part junction (polymorphic)
    for diagram_id, part_ids in links.get('diagram_to_part', {}).items():
        if diagram_id not in valid_causal_diagram_ids:
            continue
        for part_id in part_ids:
            # Determine part_type based on which valid ID set it's in
            if part_id in valid_variable_ids:
                diagram_part_rows.append({
                    'causal_diagram_id': diagram_id,
                    'part_id': part_id,
                    'part_type': 'variable',
                })
            elif part_id in valid_process_ids:
                diagram_part_rows.append({
                    'causal_diagram_id': diagram_id,
                    'part_id': part_id,
                    'part_type': 'process',
                })
            else:
                # Skip if part is neither variable nor process
                skipped_diagram_part += 1

    print(f"Built extended junction tables:")
    print(f"  - software_author: {len(software_author_rows)} rows")
    print(f"  - version_author: {len(version_author_rows)} rows")
    print(f"  - configuration_author: {len(configuration_author_rows)} rows")
    print(f"  - software_version_category: {len(version_category_rows)} rows")
    print(f"  - software_category: {len(software_category_rows)} rows")
    print(f"  - modelconfiguration_category: {len(mc_category_rows)} rows")
    print(f"  - modelconfigurationsetup_category: {len(mcs_category_rows)} rows")
    print(f"  - software_version_process: {len(version_process_rows)} rows")
    print(f"  - software_version_grid: {len(version_grid_rows)} rows")
    print(f"  - software_version_image: {len(version_image_rows)} rows")
    print(f"  - software_version_input_variable: {len(version_input_variable_rows)} rows")
    print(f"  - software_version_output_variable: {len(version_output_variable_rows)} rows")
    print(f"  - configuration_causal_diagram: {len(config_causal_diagram_rows)} rows")
    print(f"  - configuration_time_interval: {len(config_time_interval_rows)} rows")
    print(f"  - configuration_region: {len(config_region_rows)} rows")
    print(f"  - setup_author: {len(setup_author_rows)} rows")
    print(f"  - setup_calibrated_variable: {len(setup_calibrated_variable_rows)} rows")
    print(f"  - setup_calibration_target: {len(setup_calibration_target_rows)} rows")
    print(f"  - parameter_intervention: {len(parameter_intervention_rows)} rows")
    print(f"  - dataset_specification_presentation: {len(dsi_presentation_rows)} rows")
    print(f"  - diagram_part: {len(diagram_part_rows)} rows")

    total_skipped = (skipped_software_category + skipped_mc_category + skipped_mcs_category +
                     skipped_version_category + skipped_version_process + skipped_version_grid +
                     skipped_version_image + skipped_version_input_variable + skipped_version_output_variable +
                     skipped_config_causal + skipped_config_time + skipped_config_region +
                     skipped_setup_author + skipped_setup_calibrated + skipped_setup_target +
                     skipped_param_intervention + skipped_dsi_presentation +
                     skipped_diagram_part)
    if total_skipped > 0:
        print(f"  - Skipped {total_skipped} junction rows referencing missing entities")

    return {
        'modelcatalog_software_author': software_author_rows,
        'modelcatalog_version_author': version_author_rows,
        'modelcatalog_configuration_author': configuration_author_rows,
        'modelcatalog_software_category': software_category_rows,
        'modelcatalog_modelconfiguration_category': mc_category_rows,
        'modelcatalog_modelconfigurationsetup_category': mcs_category_rows,
        'modelcatalog_software_version_category': version_category_rows,
        'modelcatalog_software_version_process': version_process_rows,
        'modelcatalog_software_version_grid': version_grid_rows,
        'modelcatalog_software_version_image': version_image_rows,
        'modelcatalog_software_version_input_variable': version_input_variable_rows,
        'modelcatalog_software_version_output_variable': version_output_variable_rows,
        'modelcatalog_configuration_causal_diagram': config_causal_diagram_rows,
        'modelcatalog_configuration_time_interval': config_time_interval_rows,
        'modelcatalog_configuration_region': config_region_rows,
        'modelcatalog_setup_author': setup_author_rows,
        'modelcatalog_setup_calibrated_variable': setup_calibrated_variable_rows,
        'modelcatalog_setup_calibration_target': setup_calibration_target_rows,
        'modelcatalog_parameter_intervention': parameter_intervention_rows,
        'modelcatalog_dataset_specification_presentation': dsi_presentation_rows,
        'modelcatalog_diagram_part': diagram_part_rows,
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

    # StandardVariable entities (D-01)
    standard_variables = deduplicate_by_id(extracted_data['standard_variables'])
    standard_variables = ensure_labels(standard_variables)

    # Unit entities (D-02)
    units = deduplicate_by_id(extracted_data['units'])
    units = ensure_labels(units)

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

    # Build valid ID sets for FK validation
    valid_standard_variable_ids = {e['id'] for e in standard_variables}
    valid_unit_ids = {e['id'] for e in units}

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

    # Validate author_id FK on Software, SoftwareVersion, ModelConfiguration
    # Some sd:author values reference URIs that aren't sd:Person typed
    valid_person_ids = {e['id'] for e in extracted_data['persons']}
    for entity in transformed['software']:
        if entity.get('author_id') and entity['author_id'] not in valid_person_ids:
            entity['author_id'] = None
    for entity in transformed['software_versions']:
        if entity.get('author_id') and entity['author_id'] not in valid_person_ids:
            entity['author_id'] = None
    for entity in transformed['model_configurations']:
        if entity.get('author_id') and entity['author_id'] not in valid_person_ids:
            entity['author_id'] = None
    for entity in transformed['model_configuration_setups']:
        if entity.get('author_id') and entity['author_id'] not in valid_person_ids:
            entity['author_id'] = None

    # Build junction table rows (original 6)
    junction_tables = build_junction_tables(extracted_data)

    # Build extended junction table rows (14 new)
    extended_junction_tables = build_extended_junction_tables(extracted_data)

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
        'modelcatalog_standard_variable': standard_variables,
        'modelcatalog_unit': units,
    }

    result.update(junction_tables)
    result.update(extended_junction_tables)

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
