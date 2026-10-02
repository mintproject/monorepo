BEGIN;

UPDATE public.modelcatalog_dataset_specification
SET "position" = NULL
WHERE id = 'https://w3id.org/okn/i/mint/6b16c7bc-25ef-4afb-bc4b-35b10cc409c9'
  AND "position" = 2;

UPDATE public.modelcatalog_dataset_specification
SET "position" = NULL
WHERE id = 'https://w3id.org/okn/i/mint/9aadd1a3-cd8c-4f52-8eda-4b897e1d786f'
  AND "position" = 4;

UPDATE public.modelcatalog_dataset_specification
SET "position" = NULL
WHERE id = 'https://w3id.org/okn/i/mint/d9caf5a9-335e-4883-a50b-699f387cf34a'
  AND "position" = 3;

COMMIT;
