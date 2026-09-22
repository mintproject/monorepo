BEGIN;

UPDATE public.modelcatalog_dataset_specification
SET "position" = NULL
WHERE id = 'https://w3id.org/okn/i/mint/modflow6_cbc_output'
  AND "position" = 1;

COMMIT;
