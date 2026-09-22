BEGIN;

-- Keep one visible MODFLOW 2005 configuration, matching the one-per-family
-- catalog policy. These setup registrations have no execution or thread
-- references; the configuration foreign keys cascade their catalog metadata.
DELETE FROM public.modelcatalog_configuration
WHERE id IN (
  'https://w3id.org/okn/i/mint/399d051b-6562-4ce2-83eb-71bb38b83c8d',
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg',
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_drought',
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_advanced',
  'https://w3id.org/okn/i/mint/d2792424-fb9d-461c-9470-4bc87ca2f05f',
  'https://w3id.org/okn/i/mint/c07a6f98-6339-4033-84b0-6cd7daca6284'
);

COMMIT;
