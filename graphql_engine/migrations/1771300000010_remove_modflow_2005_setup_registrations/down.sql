BEGIN;

-- The deleted setup registrations had no execution/thread references, but
-- their original full metadata is not reproduced here. Restore the prior
-- fixture/catalog revision to recover them.

COMMIT;
