BEGIN;

-- The live persistent catalog can contain these canonical specifications with
-- null positions even when the original normalization migration is recorded
-- as applied. ExecutionCreation needs the component output slots to construct
-- a Tapis job request, so repair only the known MODFLOW-2000 specifications.
UPDATE public.modelcatalog_dataset_specification
SET "position" = 2
WHERE id = 'https://w3id.org/okn/i/mint/6b16c7bc-25ef-4afb-bc4b-35b10cc409c9'
  AND "position" IS NULL;

UPDATE public.modelcatalog_dataset_specification
SET "position" = 4
WHERE id = 'https://w3id.org/okn/i/mint/9aadd1a3-cd8c-4f52-8eda-4b897e1d786f'
  AND "position" IS NULL;

UPDATE public.modelcatalog_dataset_specification
SET "position" = 3
WHERE id = 'https://w3id.org/okn/i/mint/d9caf5a9-335e-4883-a50b-699f387cf34a'
  AND "position" IS NULL;

COMMIT;
