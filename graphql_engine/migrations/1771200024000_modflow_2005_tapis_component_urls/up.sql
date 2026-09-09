UPDATE public.modelcatalog_configuration
SET has_component_location = 'https://tapis.tapis.io/v3/apps/modflow-2005/0.0.6'
WHERE id IN (
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_advanced',
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg',
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_drought'
);
