ALTER TABLE thread
ADD COLUMN dataset_id text;

-- down.sql
ALTER TABLE thread
DROP COLUMN dataset_id;