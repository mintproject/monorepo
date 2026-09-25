BEGIN;

-- The corrected MODFLOW 6 image is deployed under the existing Tapis app
-- registration. Point the canonical catalog configuration at that app
-- version rather than the superseded archive-capable registration.
UPDATE public.modelcatalog_configuration
SET has_component_location =
  'https://portals.tapis.io/v3/apps/modflow6-simulation/0.0.ad59a69'
WHERE id =
  'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488'
  AND has_component_location =
    'https://portals.tapis.io/v3/apps/modflow6-simulation/0.0.febed09';

COMMIT;
