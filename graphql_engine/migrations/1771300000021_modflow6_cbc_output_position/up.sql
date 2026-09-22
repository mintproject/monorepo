BEGIN;

-- ExecutionCreation uses the catalog position to construct the output
-- contract passed to the Tapis/local execution adapters. The MODFLOW 6
-- configuration has one declared output, so its position is 1.
UPDATE public.modelcatalog_dataset_specification
SET "position" = 1
WHERE id = 'https://w3id.org/okn/i/mint/modflow6_cbc_output'
  AND "position" IS NULL;

COMMIT;
