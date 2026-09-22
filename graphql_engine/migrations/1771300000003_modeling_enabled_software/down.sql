BEGIN;

ALTER TABLE public.modelcatalog_software
  DROP COLUMN is_modeling_enabled;

COMMIT;
