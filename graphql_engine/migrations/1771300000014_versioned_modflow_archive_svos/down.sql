BEGIN;

UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable =
  'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-simulation-archive'
WHERE id IN (
  'https://w3id.org/okn/i/mint/wmobley-modflow-6-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-96-simulation-archive',
  'https://w3id.org/okn/i/mint/b08fd7d3-24c2-48cc-83be-a52b73fdf212'
);

DELETE FROM public.modelcatalog_standard_variable
WHERE id IN (
  'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow6-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow2000-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow2005-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow96-simulation-archive'
);

COMMIT;
