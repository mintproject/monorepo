BEGIN;

-- The spring-flow problem statement selects the base MODFLOW-2005
-- configuration directly. Its component location must be a Tapis app
-- descriptor when the Ensemble Manager runs with the Tapis engine; the old
-- WINGS archive causes the executor to parse binary `PK` bytes as JSON.
UPDATE public.modelcatalog_configuration
SET has_component_location = 'https://tapis.tapis.io/v3/apps/modflow-2005/0.0.6'
WHERE id = 'https://w3id.org/okn/i/mint/modflow_2005_cfg'
  AND has_component_location LIKE 'https://github.com/%MODFLOW2005.zip';

COMMIT;
