BEGIN;

-- Re-add the legacy model_id column (nullable text, no FK)
ALTER TABLE execution ADD COLUMN model_id text;

COMMIT;
