BEGIN;

-- This data repair is intentionally not reversible. The up migration only
-- changes rows that were null, but a down migration cannot distinguish those
-- rows from positions that were already valid before this migration ran.
-- Preserve valid catalog metadata rather than clearing it during rollback.

COMMIT;
