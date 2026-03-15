/**
 * GraphQL field selection strings for each Hasura modelcatalog entity table.
 *
 * Derived from graphql_engine/metadata/tables.yaml in the mint repository.
 * Each string lists:
 *   - All scalar columns (from select_permissions)
 *   - Object relationships (single FK joins, `{ id label }`)
 *   - Array relationships through junction tables (traverse to target entity `{ id label }`)
 *   - Direct array relationships (e.g., versions, setups)
 *
 * Junction tables themselves do not need standalone entries; they are always
 * accessed through the entity that owns the relationship.
 *
 * Export contract:
 *   - FIELD_SELECTIONS: Record<string, string> — table name to selection string
 *   - getFieldSelection(table): string — returns selection or falls back to `id label`
 */

export const FIELD_SELECTIONS: Record<string, string> = {
  // =========================================================================
  // modelcatalog_software
  // Columns: id, label, description, keywords, license, website,
  //          date_created, date_published, has_documentation, has_download_url,
  //          has_purpose, author_id, type
  // Object relationships: author -> modelcatalog_person
  // Array relationships:
  //   versions -> modelcatalog_software_version (direct)
  //   authors  -> modelcatalog_software_author (junction) -> person
  // =========================================================================
  modelcatalog_software: `
id
label
description
keywords
license
website
date_created
date_published
has_documentation
has_download_url
has_purpose
author_id
type
author {
  id
  label
}
versions {
  id
  label
  description
}
authors {
  person {
    id
    label
  }
}
`.trim(),

  // =========================================================================
  // modelcatalog_software_version
  // Columns: id, software_id, version_id, label, description, keywords,
  //          has_usage_notes, date_created, has_source_code, short_description,
  //          limitations, parameterization, runtime_estimation, theoretical_basis,
  //          author_id
  // Object relationships: software -> modelcatalog_software
  //                       author   -> modelcatalog_person
  // Array relationships (direct): configurations -> modelcatalog_model_configuration
  // Array relationships (junction):
  //   categories        -> modelcatalog_software_version_category -> category
  //   processes         -> modelcatalog_software_version_process -> process
  //   grids             -> modelcatalog_software_version_grid -> grid
  //   explanation_diagrams -> modelcatalog_software_version_image -> image
  //   input_variables   -> modelcatalog_software_version_input_variable -> variable
  //   output_variables  -> modelcatalog_software_version_output_variable -> variable
  //   authors           -> modelcatalog_version_author -> person
  // =========================================================================
  modelcatalog_software_version: `
id
software_id
version_id
label
description
keywords
has_usage_notes
date_created
has_source_code
short_description
limitations
parameterization
runtime_estimation
theoretical_basis
author_id
software {
  id
  label
}
author {
  id
  label
}
configurations {
  id
  label
  description
}
categories {
  category {
    id
    label
  }
}
processes {
  process {
    id
    label
  }
}
grids {
  grid {
    id
    label
  }
}
explanation_diagrams {
  image {
    id
    label
  }
}
input_variables {
  variable {
    id
    label
  }
}
output_variables {
  variable {
    id
    label
  }
}
authors {
  person {
    id
    label
  }
}
`.trim(),

  // =========================================================================
  // modelcatalog_model_configuration
  // Columns: id, software_version_id, label, description, keywords,
  //          usage_notes, has_component_location, has_implementation_script_location,
  //          has_software_image, has_model_result_table, author_id
  // Object relationships: software_version -> modelcatalog_software_version
  //                       author           -> modelcatalog_person
  // Array relationships (direct): setups -> modelcatalog_model_configuration_setup
  // Array relationships (junction):
  //   inputs          -> modelcatalog_configuration_input -> input (dataset_specification)
  //   outputs         -> modelcatalog_configuration_output -> output (dataset_specification)
  //   parameters      -> modelcatalog_configuration_parameter -> parameter
  //   causal_diagrams -> modelcatalog_configuration_causal_diagram -> causal_diagram
  //   time_intervals  -> modelcatalog_configuration_time_interval -> time_interval
  //   regions         -> modelcatalog_configuration_region -> region
  //   authors         -> modelcatalog_configuration_author -> person
  // =========================================================================
  modelcatalog_model_configuration: `
id
software_version_id
label
description
keywords
usage_notes
has_component_location
has_implementation_script_location
has_software_image
has_model_result_table
author_id
software_version {
  id
  label
}
author {
  id
  label
}
setups {
  id
  label
  description
}
inputs {
  input {
    id
    label
    description
    has_format
    has_dimensionality
    position
  }
}
outputs {
  output {
    id
    label
    description
    has_format
    has_dimensionality
    position
  }
}
parameters {
  parameter {
    id
    label
    description
    has_data_type
    has_default_value
    has_minimum_accepted_value
    has_maximum_accepted_value
    has_fixed_value
    has_accepted_values
    position
    parameter_type
  }
}
causal_diagrams {
  causal_diagram {
    id
    label
  }
}
time_intervals {
  time_interval {
    id
    label
    description
    interval_value
    interval_unit
  }
}
regions {
  region {
    id
    label
    description
  }
}
authors {
  person {
    id
    label
  }
}
`.trim(),

  // =========================================================================
  // modelcatalog_model_configuration_setup
  // Columns: id, model_configuration_id, label, description,
  //          has_component_location, has_implementation_script_location,
  //          has_software_image, has_region, author_id, calibration_interval,
  //          calibration_method, parameter_assignment_method, valid_until
  // Object relationships: model_configuration -> modelcatalog_model_configuration
  //                       author              -> modelcatalog_person
  // Array relationships (junction):
  //   inputs               -> modelcatalog_setup_input -> input (dataset_specification)
  //   outputs              -> modelcatalog_setup_output -> output (dataset_specification)
  //   parameters           -> modelcatalog_setup_parameter -> parameter
  //   authors              -> modelcatalog_setup_author -> person
  //   calibrated_variables -> modelcatalog_setup_calibrated_variable -> variable
  //   calibration_targets  -> modelcatalog_setup_calibration_target -> variable
  // =========================================================================
  modelcatalog_model_configuration_setup: `
id
model_configuration_id
label
description
has_component_location
has_implementation_script_location
has_software_image
has_region
author_id
calibration_interval
calibration_method
parameter_assignment_method
valid_until
model_configuration {
  id
  label
}
author {
  id
  label
}
inputs {
  input {
    id
    label
    description
    has_format
    has_dimensionality
    position
  }
}
outputs {
  output {
    id
    label
    description
    has_format
    has_dimensionality
    position
  }
}
parameters {
  parameter {
    id
    label
    description
    has_data_type
    has_default_value
    has_minimum_accepted_value
    has_maximum_accepted_value
    has_fixed_value
    has_accepted_values
    position
    parameter_type
  }
}
authors {
  person {
    id
    label
  }
}
calibrated_variables {
  variable {
    id
    label
  }
}
calibration_targets {
  variable {
    id
    label
  }
}
`.trim(),

  // =========================================================================
  // modelcatalog_dataset_specification
  // Columns: id, label, description, has_format, has_dimensionality, position
  // No relationships used standalone (accessed via junction traversal)
  // =========================================================================
  modelcatalog_dataset_specification: `
id
label
description
has_format
has_dimensionality
position
`.trim(),

  // =========================================================================
  // modelcatalog_parameter
  // Columns: id, label, description, has_data_type, has_default_value,
  //          has_minimum_accepted_value, has_maximum_accepted_value,
  //          has_fixed_value, position, parameter_type
  // Array relationships (junction):
  //   interventions -> modelcatalog_parameter_intervention -> intervention
  // =========================================================================
  modelcatalog_parameter: `
id
label
description
has_data_type
has_default_value
has_minimum_accepted_value
has_maximum_accepted_value
has_fixed_value
has_accepted_values
position
parameter_type
interventions {
  intervention {
    id
    label
  }
}
`.trim(),

  // =========================================================================
  // modelcatalog_person
  // Columns: id, label, name
  // =========================================================================
  modelcatalog_person: `
id
label
name
`.trim(),

  // =========================================================================
  // modelcatalog_model_category
  // Columns: id, label, parent_category_id
  // Object relationships: parent_category -> modelcatalog_model_category (self)
  // Array relationships (direct): subcategories -> modelcatalog_model_category (self)
  // =========================================================================
  modelcatalog_model_category: `
id
label
parent_category_id
parent_category {
  id
  label
}
subcategories {
  id
  label
}
`.trim(),

  // =========================================================================
  // modelcatalog_region
  // Columns: id, label, description, part_of_id
  // Object relationships: part_of -> modelcatalog_region (self)
  // Array relationships (direct): subregions -> modelcatalog_region (self)
  // =========================================================================
  modelcatalog_region: `
id
label
description
part_of_id
part_of {
  id
  label
}
subregions {
  id
  label
}
`.trim(),

  // =========================================================================
  // modelcatalog_process
  // Columns: id, label
  // =========================================================================
  modelcatalog_process: `
id
label
`.trim(),

  // =========================================================================
  // modelcatalog_time_interval
  // Columns: id, label, description, interval_value, interval_unit
  // =========================================================================
  modelcatalog_time_interval: `
id
label
description
interval_value
interval_unit
`.trim(),

  // =========================================================================
  // modelcatalog_causal_diagram
  // Columns: id, label
  // Array relationships (junction):
  //   diagram_parts -> modelcatalog_diagram_part (polymorphic: part_id, part_type)
  // Note: diagram_parts is polymorphic (part_type: 'variable' | 'process'),
  //       so we include part_id and part_type from the junction itself
  // =========================================================================
  modelcatalog_causal_diagram: `
id
label
diagram_parts {
  part_id
  part_type
}
`.trim(),

  // =========================================================================
  // modelcatalog_image
  // Columns: id, label, description
  // =========================================================================
  modelcatalog_image: `
id
label
description
`.trim(),

  // =========================================================================
  // modelcatalog_variable_presentation
  // Columns: id, label, description, has_long_name, has_short_name,
  //          has_standard_variable, uses_unit
  // =========================================================================
  modelcatalog_variable_presentation: `
id
label
description
has_long_name
has_short_name
has_standard_variable
uses_unit
`.trim(),

  // =========================================================================
  // modelcatalog_intervention
  // Columns: id, label, description
  // =========================================================================
  modelcatalog_intervention: `
id
label
description
`.trim(),

  // =========================================================================
  // modelcatalog_grid
  // Columns: id, label, description, has_dimension, has_shape,
  //          has_spatial_resolution, has_coordinate_system, grid_type
  // =========================================================================
  modelcatalog_grid: `
id
label
description
has_dimension
has_shape
has_spatial_resolution
has_coordinate_system
grid_type
`.trim(),
};

/**
 * Return the GraphQL field selection string for a given Hasura table name.
 * Falls back to `id label` if no specific selection is defined.
 */
export function getFieldSelection(tableName: string): string {
  return FIELD_SELECTIONS[tableName] ?? 'id label';
}
