BEGIN;

ALTER TABLE adapter.transform_edge
  DROP COLUMN IF EXISTS compatibility_json;

ALTER TABLE public.modelcatalog_configuration
  DROP COLUMN IF EXISTS tapis_app_version,
  DROP COLUMN IF EXISTS tapis_app_id;

COMMIT;
