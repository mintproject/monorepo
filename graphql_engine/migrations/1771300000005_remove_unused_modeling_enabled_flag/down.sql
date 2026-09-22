BEGIN;

ALTER TABLE public.modelcatalog_software
  ADD COLUMN is_modeling_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMIT;
