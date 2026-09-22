BEGIN;

UPDATE public.modelcatalog_dataset_specification
SET has_format = NULL
WHERE id IN (
  'https://w3id.org/okn/i/mint/477f958f-428a-489c-8c7a-8ac7ab8d5124',
  'https://w3id.org/okn/i/mint/56acb8fe-9b53-4124-83c0-2b0025bf9361',
  'https://w3id.org/okn/i/mint/6b16c7bc-25ef-4afb-bc4b-35b10cc409c9',
  'https://w3id.org/okn/i/mint/6c886b55-6965-41e5-96f1-9e6ae963bcd7',
  'https://w3id.org/okn/i/mint/852c7bb1-3949-49ef-8f71-b7ec539e68e2'
);

UPDATE public.modelcatalog_dataset_specification
SET has_format = 'cbb'
WHERE id IN (
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_advanced_cbb',
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_cbb',
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_drought_cbb',
  'https://w3id.org/okn/i/mint/modflow_2005_cbb'
);

COMMIT;
