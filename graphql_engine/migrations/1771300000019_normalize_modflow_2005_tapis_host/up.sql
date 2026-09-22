BEGIN;

UPDATE public.modelcatalog_configuration
SET has_component_location = 'https://tapis.tapis.io/v3/apps/modflow-2005/0.0.6'
WHERE id = 'https://w3id.org/okn/i/mint/modflow_2005_cfg'
  AND has_component_location = 'https://tapis.tacc.utexas.edu/v3/apps/modflow-2005/0.0.6';

COMMIT;
