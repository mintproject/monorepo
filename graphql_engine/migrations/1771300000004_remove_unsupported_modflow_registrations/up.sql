BEGIN;

-- These are catalog entries for workflows that are not part of the four
-- runnable MODFLOW families supported by the modeling UI. No thread models
-- reference their configurations in the current catalog. The MT3D entry has
-- one child setup, which must be removed before its parent because the catalog
-- self-reference is intentionally not cascading.
DELETE FROM public.modelcatalog_configuration
WHERE id = 'https://w3id.org/okn/i/mint/8cac141d-96f4-439b-8a15-247344cb2c32';

DELETE FROM public.modelcatalog_configuration
WHERE id IN (
  'https://w3id.org/okn/i/mint/37d17ee0-0ce6-4095-9f32-90c1b33859f2',
  'https://w3id.org/okn/i/mint/e6becd2c-29d1-482e-b94b-388cdc584e3a'
);

DELETE FROM public.modelcatalog_software
WHERE id IN (
  'https://w3id.org/okn/i/mint/ac0a108b-eca1-4f20-af3e-d6d87f29e03f',
  'https://w3id.org/okn/i/mint/5178a907-4464-45b4-bc12-404e7c7eeab2'
);

COMMIT;
