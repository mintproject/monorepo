BEGIN;

-- The MODFLOW 6 configuration must use the archive-capable app manifest. The
-- older app version exposes mf6-nam as a required file input and cannot accept
-- the catalog's canonical simulation-archive contract.
UPDATE public.modelcatalog_configuration
SET has_component_location =
  'https://portals.tapis.io/v3/apps/modflow6-simulation/0.0.febed09'
WHERE id =
  'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488'
  AND has_component_location =
    'https://portals.tapis.io/v3/apps/modflow6-simulation/0.0.fb606ee';

COMMIT;
