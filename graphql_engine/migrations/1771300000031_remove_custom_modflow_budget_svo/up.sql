-- MODFLOW CBC files are adapter inputs, not aquifer_system__volumetric_budget
-- outputs. Keep the file contract format-only so the adapter can infer the
-- canonical chain into the requested spring__volume_flow_rate SVO.
BEGIN;

UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable = NULL
WHERE has_standard_variable IN (
  'https://w3id.org/okn/i/mint/wmobley-standard-variable-aquifer-system-volumetric-budget',
  'https://w3id.org/okn/i/mint/wmobley/standard-variable/aquifer_system__volumetric_budget'
);

DELETE FROM public.modelcatalog_standard_variable
WHERE id IN (
  'https://w3id.org/okn/i/mint/wmobley-standard-variable-aquifer-system-volumetric-budget',
  'https://w3id.org/okn/i/mint/wmobley/standard-variable/aquifer_system__volumetric_budget'
);

COMMIT;
