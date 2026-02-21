/**
 * Resource registry: maps API resource path segments to Hasura table metadata,
 * type URIs/names, and relationship configurations.
 *
 * All 46 API resource types are covered. Types without a dedicated Hasura table
 * have hasuraTable set to null.
 */

export interface RelationshipConfig {
  /** Hasura relationship name (as defined in metadata) */
  hasuraRelName: string;
  /** Whether this is a single object or array relationship */
  type: 'object' | 'array';
  /** Junction table name, if this relationship goes through one */
  junctionTable?: string;
  /**
   * Relationship name inside the junction row that points to the target entity.
   * Only set when junctionTable is present.
   * e.g. for 'authors' -> modelcatalog_software_author -> person, junctionRelName = 'person'
   * e.g. for 'inputs' -> modelcatalog_setup_input -> input, junctionRelName = 'input'
   */
  junctionRelName?: string;
  /** The API resource name of the target type (for nested transforms) */
  targetResource: string;
}

export interface ResourceConfig {
  /** Hasura table name, or null if no dedicated table exists */
  hasuraTable: string | null;
  /** Primary OWL type URI */
  typeUri: string;
  /** Short type name (last segment of type URI) */
  typeName: string;
  /** Full type array for the 'type' field in responses (may include parent classes) */
  typeArray: string[];
  /** ID prefix for constructing full URIs */
  idPrefix: string;
  /** Map from API camelCase field name to Hasura relationship config */
  relationships: Record<string, RelationshipConfig>;
}

const ID_PREFIX = 'https://w3id.org/okn/i/mint/';

/**
 * All 46 API resource types mapped to their Hasura metadata.
 * Keys are the API path segments (as they appear in URL paths).
 */
export const RESOURCE_REGISTRY: Record<string, ResourceConfig> = {
  // =========================================================================
  // Core hierarchy: Software > SoftwareVersion > ModelConfiguration > Setup
  // =========================================================================

  softwares: {
    hasuraTable: 'modelcatalog_software',
    typeUri: 'https://w3id.org/okn/o/sd#Software',
    typeName: 'Software',
    typeArray: ['Software'],
    idPrefix: ID_PREFIX,
    relationships: {
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      authors: {
        hasuraRelName: 'authors',
        type: 'array',
        junctionTable: 'modelcatalog_software_author',
        junctionRelName: 'person',
        targetResource: 'persons',
      },
      hasVersion: {
        hasuraRelName: 'versions',
        type: 'array',
        targetResource: 'softwareversions',
      },
    },
  },

  softwareversions: {
    hasuraTable: 'modelcatalog_software_version',
    typeUri: 'https://w3id.org/okn/o/sd#SoftwareVersion',
    typeName: 'SoftwareVersion',
    typeArray: ['SoftwareVersion'],
    idPrefix: ID_PREFIX,
    relationships: {
      software: {
        hasuraRelName: 'software',
        type: 'object',
        targetResource: 'softwares',
      },
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      authors: {
        hasuraRelName: 'authors',
        type: 'array',
        junctionTable: 'modelcatalog_version_author',
        junctionRelName: 'person',
        targetResource: 'persons',
      },
      hasConfiguration: {
        hasuraRelName: 'configurations',
        type: 'array',
        targetResource: 'modelconfigurations',
      },
      hasModelCategory: {
        hasuraRelName: 'categories',
        type: 'array',
        junctionTable: 'modelcatalog_software_version_category',
        junctionRelName: 'category',
        targetResource: 'modelcategorys',
      },
      hasProcess: {
        hasuraRelName: 'processes',
        type: 'array',
        junctionTable: 'modelcatalog_software_version_process',
        junctionRelName: 'process',
        targetResource: 'processs',
      },
      hasGrid: {
        hasuraRelName: 'grids',
        type: 'array',
        junctionTable: 'modelcatalog_software_version_grid',
        junctionRelName: 'grid',
        targetResource: 'grids',
      },
      hasExplanationDiagram: {
        hasuraRelName: 'explanation_diagrams',
        type: 'array',
        junctionTable: 'modelcatalog_software_version_image',
        junctionRelName: 'image',
        targetResource: 'images',
      },
      hasInputVariable: {
        hasuraRelName: 'input_variables',
        type: 'array',
        junctionTable: 'modelcatalog_software_version_input_variable',
        junctionRelName: 'variable',
        targetResource: 'variablepresentations',
      },
      hasOutputVariable: {
        hasuraRelName: 'output_variables',
        type: 'array',
        junctionTable: 'modelcatalog_software_version_output_variable',
        junctionRelName: 'variable',
        targetResource: 'variablepresentations',
      },
    },
  },

  modelconfigurations: {
    hasuraTable: 'modelcatalog_model_configuration',
    typeUri: 'https://w3id.org/okn/o/sdm#ModelConfiguration',
    typeName: 'ModelConfiguration',
    typeArray: ['ModelConfiguration'],
    idPrefix: ID_PREFIX,
    relationships: {
      softwareVersion: {
        hasuraRelName: 'software_version',
        type: 'object',
        targetResource: 'softwareversions',
      },
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      authors: {
        hasuraRelName: 'authors',
        type: 'array',
        junctionTable: 'modelcatalog_configuration_author',
        junctionRelName: 'person',
        targetResource: 'persons',
      },
      hasSetup: {
        hasuraRelName: 'setups',
        type: 'array',
        targetResource: 'modelconfigurationsetups',
      },
      hasInput: {
        hasuraRelName: 'inputs',
        type: 'array',
        junctionTable: 'modelcatalog_configuration_input',
        junctionRelName: 'input',
        targetResource: 'datasetspecifications',
      },
      hasOutput: {
        hasuraRelName: 'outputs',
        type: 'array',
        junctionTable: 'modelcatalog_configuration_output',
        junctionRelName: 'output',
        targetResource: 'datasetspecifications',
      },
      hasParameter: {
        hasuraRelName: 'parameters',
        type: 'array',
        junctionTable: 'modelcatalog_configuration_parameter',
        junctionRelName: 'parameter',
        targetResource: 'parameters',
      },
      hasCausalDiagram: {
        hasuraRelName: 'causal_diagrams',
        type: 'array',
        junctionTable: 'modelcatalog_configuration_causal_diagram',
        junctionRelName: 'causal_diagram',
        targetResource: 'causaldiagrams',
      },
      hasOutputTimeInterval: {
        hasuraRelName: 'time_intervals',
        type: 'array',
        junctionTable: 'modelcatalog_configuration_time_interval',
        junctionRelName: 'time_interval',
        targetResource: 'timeintervals',
      },
      hasRegion: {
        hasuraRelName: 'regions',
        type: 'array',
        junctionTable: 'modelcatalog_configuration_region',
        junctionRelName: 'region',
        targetResource: 'regions',
      },
    },
  },

  modelconfigurationsetups: {
    hasuraTable: 'modelcatalog_model_configuration_setup',
    typeUri: 'https://w3id.org/okn/o/sdm#ModelConfigurationSetup',
    typeName: 'ModelConfigurationSetup',
    typeArray: ['ModelConfigurationSetup'],
    idPrefix: ID_PREFIX,
    relationships: {
      modelConfiguration: {
        hasuraRelName: 'model_configuration',
        type: 'object',
        targetResource: 'modelconfigurations',
      },
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      authors: {
        hasuraRelName: 'authors',
        type: 'array',
        junctionTable: 'modelcatalog_setup_author',
        junctionRelName: 'person',
        targetResource: 'persons',
      },
      hasInput: {
        hasuraRelName: 'inputs',
        type: 'array',
        junctionTable: 'modelcatalog_setup_input',
        junctionRelName: 'input',
        targetResource: 'datasetspecifications',
      },
      hasOutput: {
        hasuraRelName: 'outputs',
        type: 'array',
        junctionTable: 'modelcatalog_setup_output',
        junctionRelName: 'output',
        targetResource: 'datasetspecifications',
      },
      hasParameter: {
        hasuraRelName: 'parameters',
        type: 'array',
        junctionTable: 'modelcatalog_setup_parameter',
        junctionRelName: 'parameter',
        targetResource: 'parameters',
      },
      calibratedVariable: {
        hasuraRelName: 'calibrated_variables',
        type: 'array',
        junctionTable: 'modelcatalog_setup_calibrated_variable',
        junctionRelName: 'variable',
        targetResource: 'variablepresentations',
      },
      calibrationTargetVariable: {
        hasuraRelName: 'calibration_targets',
        type: 'array',
        junctionTable: 'modelcatalog_setup_calibration_target',
        junctionRelName: 'variable',
        targetResource: 'variablepresentations',
      },
    },
  },

  // Alias: configurationsetups maps to the same table as modelconfigurationsetups
  configurationsetups: {
    hasuraTable: 'modelcatalog_model_configuration_setup',
    typeUri: 'https://w3id.org/okn/o/sd#ConfigurationSetup',
    typeName: 'ConfigurationSetup',
    typeArray: ['ConfigurationSetup'],
    idPrefix: ID_PREFIX,
    relationships: {
      modelConfiguration: {
        hasuraRelName: 'model_configuration',
        type: 'object',
        targetResource: 'modelconfigurations',
      },
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      authors: {
        hasuraRelName: 'authors',
        type: 'array',
        junctionTable: 'modelcatalog_setup_author',
        junctionRelName: 'person',
        targetResource: 'persons',
      },
      hasInput: {
        hasuraRelName: 'inputs',
        type: 'array',
        junctionTable: 'modelcatalog_setup_input',
        junctionRelName: 'input',
        targetResource: 'datasetspecifications',
      },
      hasOutput: {
        hasuraRelName: 'outputs',
        type: 'array',
        junctionTable: 'modelcatalog_setup_output',
        junctionRelName: 'output',
        targetResource: 'datasetspecifications',
      },
      hasParameter: {
        hasuraRelName: 'parameters',
        type: 'array',
        junctionTable: 'modelcatalog_setup_parameter',
        junctionRelName: 'parameter',
        targetResource: 'parameters',
      },
      calibratedVariable: {
        hasuraRelName: 'calibrated_variables',
        type: 'array',
        junctionTable: 'modelcatalog_setup_calibrated_variable',
        junctionRelName: 'variable',
        targetResource: 'variablepresentations',
      },
      calibrationTargetVariable: {
        hasuraRelName: 'calibration_targets',
        type: 'array',
        junctionTable: 'modelcatalog_setup_calibration_target',
        junctionRelName: 'variable',
        targetResource: 'variablepresentations',
      },
    },
  },

  // =========================================================================
  // I/O and parameter entity types
  // =========================================================================

  datasetspecifications: {
    hasuraTable: 'modelcatalog_dataset_specification',
    typeUri: 'https://w3id.org/okn/o/sd#DatasetSpecification',
    typeName: 'DatasetSpecification',
    typeArray: ['DatasetSpecification'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  parameters: {
    hasuraTable: 'modelcatalog_parameter',
    typeUri: 'https://w3id.org/okn/o/sd#Parameter',
    typeName: 'Parameter',
    typeArray: ['Parameter'],
    idPrefix: ID_PREFIX,
    relationships: {
      hasIntervention: {
        hasuraRelName: 'interventions',
        type: 'array',
        junctionTable: 'modelcatalog_parameter_intervention',
        junctionRelName: 'intervention',
        targetResource: 'interventions',
      },
    },
  },

  // =========================================================================
  // Reference entity types with dedicated Hasura tables
  // =========================================================================

  persons: {
    hasuraTable: 'modelcatalog_person',
    typeUri: 'https://w3id.org/okn/o/sd#Person',
    typeName: 'Person',
    typeArray: ['Person'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  modelcategorys: {
    hasuraTable: 'modelcatalog_model_category',
    typeUri: 'https://w3id.org/okn/o/sdm#ModelCategory',
    typeName: 'ModelCategory',
    typeArray: ['ModelCategory'],
    idPrefix: ID_PREFIX,
    relationships: {
      parentCategory: {
        hasuraRelName: 'parent_category',
        type: 'object',
        targetResource: 'modelcategorys',
      },
      subcategories: {
        hasuraRelName: 'subcategories',
        type: 'array',
        targetResource: 'modelcategorys',
      },
    },
  },

  regions: {
    hasuraTable: 'modelcatalog_region',
    typeUri: 'https://w3id.org/okn/o/sdm#Region',
    typeName: 'Region',
    typeArray: ['Region'],
    idPrefix: ID_PREFIX,
    relationships: {
      partOf: {
        hasuraRelName: 'part_of',
        type: 'object',
        targetResource: 'regions',
      },
      subregions: {
        hasuraRelName: 'subregions',
        type: 'array',
        targetResource: 'regions',
      },
    },
  },

  processs: {
    hasuraTable: 'modelcatalog_process',
    typeUri: 'https://w3id.org/okn/o/sdm#Process',
    typeName: 'Process',
    typeArray: ['Process'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  timeintervals: {
    hasuraTable: 'modelcatalog_time_interval',
    typeUri: 'https://w3id.org/okn/o/sdm#TimeInterval',
    typeName: 'TimeInterval',
    typeArray: ['TimeInterval'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  causaldiagrams: {
    hasuraTable: 'modelcatalog_causal_diagram',
    typeUri: 'https://w3id.org/okn/o/sdm#CausalDiagram',
    typeName: 'CausalDiagram',
    typeArray: ['CausalDiagram'],
    idPrefix: ID_PREFIX,
    relationships: {
      hasPart: {
        hasuraRelName: 'diagram_parts',
        type: 'array',
        junctionTable: 'modelcatalog_diagram_part',
        targetResource: 'variablepresentations',
      },
    },
  },

  images: {
    hasuraTable: 'modelcatalog_image',
    typeUri: 'https://w3id.org/okn/o/sd#Image',
    typeName: 'Image',
    typeArray: ['Image'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  variablepresentations: {
    hasuraTable: 'modelcatalog_variable_presentation',
    typeUri: 'https://w3id.org/okn/o/sd#VariablePresentation',
    typeName: 'VariablePresentation',
    typeArray: ['VariablePresentation'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  interventions: {
    hasuraTable: 'modelcatalog_intervention',
    typeUri: 'https://w3id.org/okn/o/sdm#Intervention',
    typeName: 'Intervention',
    typeArray: ['Intervention'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  grids: {
    hasuraTable: 'modelcatalog_grid',
    typeUri: 'https://w3id.org/okn/o/sdm#Grid',
    typeName: 'Grid',
    typeArray: ['Grid'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  // =========================================================================
  // Software subtypes -- map to modelcatalog_software (type discriminator)
  // =========================================================================

  models: {
    // Model is a subclass of Software in the OKN ontology (sdm:Model rdfs:subClassOf sd:Software)
    hasuraTable: 'modelcatalog_software',
    typeUri: 'https://w3id.org/okn/o/sdm#Model',
    typeName: 'Model',
    typeArray: ['Model', 'SoftwareDescription'],
    idPrefix: ID_PREFIX,
    relationships: {
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      authors: {
        hasuraRelName: 'authors',
        type: 'array',
        junctionTable: 'modelcatalog_software_author',
        junctionRelName: 'person',
        targetResource: 'persons',
      },
      hasVersion: {
        hasuraRelName: 'versions',
        type: 'array',
        targetResource: 'softwareversions',
      },
    },
  },

  empiricalmodels: {
    hasuraTable: 'modelcatalog_software',
    typeUri: 'https://w3id.org/okn/o/sdm#EmpiricalModel',
    typeName: 'EmpiricalModel',
    typeArray: ['EmpiricalModel'],
    idPrefix: ID_PREFIX,
    relationships: {
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      hasVersion: {
        hasuraRelName: 'versions',
        type: 'array',
        targetResource: 'softwareversions',
      },
    },
  },

  hybridmodels: {
    hasuraTable: 'modelcatalog_software',
    typeUri: 'https://w3id.org/okn/o/sdm#HybridModel',
    typeName: 'HybridModel',
    typeArray: ['HybridModel'],
    idPrefix: ID_PREFIX,
    relationships: {
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      hasVersion: {
        hasuraRelName: 'versions',
        type: 'array',
        targetResource: 'softwareversions',
      },
    },
  },

  emulators: {
    hasuraTable: 'modelcatalog_software',
    typeUri: 'https://w3id.org/okn/o/sdm#Emulator',
    typeName: 'Emulator',
    typeArray: ['Emulator'],
    idPrefix: ID_PREFIX,
    relationships: {
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      hasVersion: {
        hasuraRelName: 'versions',
        type: 'array',
        targetResource: 'softwareversions',
      },
    },
  },

  'theory-guidedmodels': {
    hasuraTable: 'modelcatalog_software',
    typeUri: 'https://w3id.org/okn/o/sdm#Theory-GuidedModel',
    typeName: 'Theory-GuidedModel',
    typeArray: ['Theory-GuidedModel'],
    idPrefix: ID_PREFIX,
    relationships: {
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      hasVersion: {
        hasuraRelName: 'versions',
        type: 'array',
        targetResource: 'softwareversions',
      },
    },
  },

  // Alias for theory-guidedmodels: OpenAPI operationId uses underscore (theory_guidedmodels_get)
  // while the URL path uses hyphen (/theory-guidedmodels). The Proxy routes operationId to resource name.
  theory_guidedmodels: {
    hasuraTable: 'modelcatalog_software',
    typeUri: 'https://w3id.org/okn/o/sdm#Theory-GuidedModel',
    typeName: 'Theory-GuidedModel',
    typeArray: ['Theory-GuidedModel'],
    idPrefix: ID_PREFIX,
    relationships: {
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      hasVersion: {
        hasuraRelName: 'versions',
        type: 'array',
        targetResource: 'softwareversions',
      },
    },
  },

  coupledmodels: {
    hasuraTable: 'modelcatalog_software',
    typeUri: 'https://w3id.org/okn/o/sdm#CoupledModel',
    typeName: 'CoupledModel',
    typeArray: ['CoupledModel'],
    idPrefix: ID_PREFIX,
    relationships: {
      author: {
        hasuraRelName: 'author',
        type: 'object',
        targetResource: 'persons',
      },
      hasVersion: {
        hasuraRelName: 'versions',
        type: 'array',
        targetResource: 'softwareversions',
      },
    },
  },

  // =========================================================================
  // Entity types WITHOUT dedicated Hasura tables (hasuraTable: null)
  // These need views or alternative query strategies in future plans.
  // =========================================================================

  catalogidentifiers: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#CatalogIdentifier',
    typeName: 'CatalogIdentifier',
    typeArray: ['CatalogIdentifier'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  constraints: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#Constraint',
    typeName: 'Constraint',
    typeArray: ['Constraint'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  datatransformations: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#DataTransformation',
    typeName: 'DataTransformation',
    typeArray: ['DataTransformation'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  datatransformationsetups: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#DataTransformationSetup',
    typeName: 'DataTransformationSetup',
    typeArray: ['DataTransformationSetup'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  equations: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sdm#Equation',
    typeName: 'Equation',
    typeArray: ['Equation'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  fundinginformations: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#FundingInformation',
    typeName: 'FundingInformation',
    typeArray: ['FundingInformation'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  geocoordinatess: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sdm#GeoCoordinates',
    typeName: 'GeoCoordinates',
    typeArray: ['GeoCoordinates'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  geoshapes: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sdm#GeoShape',
    typeName: 'GeoShape',
    typeArray: ['GeoShape'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  numericalindexs: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#NumericalIndex',
    typeName: 'NumericalIndex',
    typeArray: ['NumericalIndex'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  organizations: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#Organization',
    typeName: 'Organization',
    typeArray: ['Organization'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  pointbasedgrids: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sdm#PointBasedGrid',
    typeName: 'PointBasedGrid',
    typeArray: ['PointBasedGrid'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  samplecollections: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#SampleCollection',
    typeName: 'SampleCollection',
    typeArray: ['SampleCollection'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  sampleexecutions: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#SampleExecution',
    typeName: 'SampleExecution',
    typeArray: ['SampleExecution'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  sampleresources: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#SampleResource',
    typeName: 'SampleResource',
    typeArray: ['SampleResource'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  softwareconfigurations: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#SoftwareConfiguration',
    typeName: 'SoftwareConfiguration',
    typeArray: ['SoftwareConfiguration'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  softwareimages: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#SoftwareImage',
    typeName: 'SoftwareImage',
    typeArray: ['SoftwareImage'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  sourcecodes: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#SourceCode',
    typeName: 'SourceCode',
    typeArray: ['SourceCode'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  spatialresolutions: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sdm#SpatialResolution',
    typeName: 'SpatialResolution',
    typeArray: ['SpatialResolution'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  spatiallydistributedgrids: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sdm#SpatiallyDistributedGrid',
    typeName: 'SpatiallyDistributedGrid',
    typeArray: ['SpatiallyDistributedGrid'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  standardvariables: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#StandardVariable',
    typeName: 'StandardVariable',
    typeArray: ['StandardVariable'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  units: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#Unit',
    typeName: 'Unit',
    typeArray: ['Unit'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  variables: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#Variable',
    typeName: 'Variable',
    typeArray: ['Variable'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },

  visualizations: {
    hasuraTable: null,
    typeUri: 'https://w3id.org/okn/o/sd#Visualization',
    typeName: 'Visualization',
    typeArray: ['Visualization'],
    idPrefix: ID_PREFIX,
    relationships: {},
  },
};

/**
 * Look up a resource config by its API path segment.
 * Returns undefined if not found.
 */
export function getResourceConfig(pathSegment: string): ResourceConfig | undefined {
  return RESOURCE_REGISTRY[pathSegment];
}

/**
 * Look up a resource config by its Hasura table name.
 * Returns the first match (useful for reverse lookups; note some resources share a table).
 */
export function getResourceByTable(tableName: string): ResourceConfig | undefined {
  return Object.values(RESOURCE_REGISTRY).find((r) => r.hasuraTable === tableName);
}
