BEGIN;

UPDATE public.modelcatalog_software
SET label = 'MODFLOW'
WHERE id = 'https://w3id.org/okn/i/mint/MODFLOW';

UPDATE public.modelcatalog_software
SET label = 'MODFLOW-2001'
WHERE id IN (
  'https://w3id.org/okn/i/mint/044308bf-48f1-414e-b0ce-d3fb4b2408b7',
  'https://w3id.org/okn/i/mint/69864dbb-68e5-4481-8d65-b8a2b861f956',
  'https://w3id.org/okn/i/mint/bc90aeb9-a5e6-4def-a574-9e45337849e4'
);

UPDATE public.modelcatalog_software
SET label = 'MODFLOW 6 Runtime Configuration (mfsim.nam + mf6)'
WHERE id = 'https://w3id.org/okn/i/mint/b051a492-ad3f-494b-8ae4-53c8a83d3881';

COMMIT;
