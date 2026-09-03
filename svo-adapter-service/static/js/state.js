// state.js - Global application state
export const STATE = {
  // Auth
  TOKEN: null,

  // Data
  SPECS: {},
  OBJECTS: [],
  DFC_OBJECTIVES: [],
  DFC_TARGET_RECORDS: [],
  GMA_BOUNDARY_FEATURES: null,
  GMA_BOUNDARY_PROMISE: null,
  DFC_MAP_REQUEST: 0,

  // Runtime
  RUNTIME_DEFAULTS: {},
  IS_DEMO: false,
  CASE_KEY: 'dfc',

  // Current selections
  PLAN_FORECAST: null,
  PLAN_DFC: null,
  SCENARIO: null,
  DFC_SELECTED_SOURCE: null,
  DFC_SELECTED_TARGET: null,

  // Constants
  OKN_NS: 'https://w3id.org/okn/i/mint/',
  TWDB_GMA_BOUNDARY_LAYER: 'https://services1.arcgis.com/7DRakJXKPEhwv0fM/arcgis/rest/services/Z_Statewide_gdb/FeatureServer/4',

  DFC_TARGETS: [
    {
      key: 'head-drawdown',
      label: 'Average drawdown / head',
      plannerLabel: 'Head / drawdown — GMA average ft',
      sourceKind: 'geotiff',
      targetMetric: 'drawdown',
      summary: 'Uses MODFLOW head output to calculate a GMA-average groundwater-level metric.',
      contract: { standard_variable_uri: 'https://w3id.org/okn/i/mint/groundwater__hydraulic_head', unit: 'ft', format: 'gma-scalar' },
    },
    {
      key: 'saturated-thickness',
      label: 'Saturated thickness',
      plannerLabel: 'Saturated thickness — GMA average ft',
      sourceKind: 'hds',
      targetMetric: 'saturated_thickness_or_storage',
      summary: 'Derives aquifer saturated thickness from modeled heads and aquifer-base information.',
      contract: { standard_variable_uri: 'https://w3id.org/okn/i/mint/aquifer__saturated_thickness', unit: 'ft', format: 'gma-scalar' },
    },
    {
      key: 'spring-flow',
      label: 'Spring flow',
      plannerLabel: 'Spring flow — cfs',
      sourceKind: 'cbc',
      targetMetric: 'spring_or_stream_flow',
      summary: 'Extracts drain/spring budget terms and converts modeled flow to cfs.',
      contract: { standard_variable_uri: 'https://w3id.org/okn/i/mint/spring__volume_flow_rate', unit: 'cfs' },
    },
    {
      key: 'stream-flow',
      label: 'Streamflow',
      plannerLabel: 'Stream flow — acre-feet/month',
      sourceKind: 'cbc',
      targetMetric: 'spring_or_stream_flow',
      summary: 'Extracts stream budget terms and converts modeled flow to acre-feet per month.',
      contract: { standard_variable_uri: 'https://w3id.org/okn/i/mint/river__volume_flow_rate', unit: 'af_month' },
    },
    {
      key: 'compliance-report',
      label: 'Compliance report',
      plannerLabel: 'DFC compliance report — planner contract',
      sourceKind: 'any',
      targetMetric: 'other',
      summary: 'Compares modeled DFC metrics against official targets once the target table is connected.',
      contract: { format: 'dfc-compliance-report' },
      note: 'The transform graph can plan to this contract; the final compliance executor still needs the registered DFC target table/CSV implementation.',
    },
  ],

  // Polling
  _pollTimer: null,
};

export function resetState() {
  STATE.SPECS = {};
  STATE.OBJECTS = [];
  STATE.DFC_OBJECTIVES = [];
  STATE.PLAN_FORECAST = null;
  STATE.PLAN_DFC = null;
  STATE.SCENARIO = null;
  STATE.DFC_SELECTED_SOURCE = null;
  STATE.DFC_SELECTED_TARGET = null;
}
