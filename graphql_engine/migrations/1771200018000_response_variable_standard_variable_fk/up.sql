-- Point the thread and task indicator columns at `modelcatalog_standard_variable`,
-- the table the client already reads them from.
--
-- `thread.response_variable_id` is written by the Variables step with a standard
-- variable id -- a URI such as `https://w3id.org/okn/i/mint/DRAWDOWN`. The
-- constraint referenced `public.variable`, whose ids are bare CSDMS-style names
-- such as `drawdown`. At TACC **0 of 668** standard variable ids are a valid
-- `variable.id`, so every save failed with a foreign key violation. The step
-- could not store anything at all.
--
-- The read side already keys on standard variable ids: `ModelsStep` filters
-- configurations on `modelcatalog_standard_variable.id`, and the picker itself
-- is a standard variable combobox. Only the constraint disagreed, so the
-- constraint moves.
--
-- `public.variable` is frozen -- the ETL writes `modelcatalog_*` tables only and
-- nothing has written `variable` since the DYNAMO migration. Mapping the client
-- onto it instead would have tied the feature to a table that can no longer grow.
--
-- Existing values are migrated by label, which is the only bridge between the two
-- id schemes: `modelcatalog_standard_variable.label` holds the CSDMS-style name
-- that `variable.id` uses. A value is mapped only when **exactly one** standard
-- variable carries that label; 62 labels are shared by up to 6 standard variables
-- and no rule can tell which one was meant, so those are nulled rather than
-- guessed. A wrong id would silently show `No models found.`, while a null shows
-- the step as unset and invites a fresh choice.
--
-- At TACC this touches one row: thread `nzGQkhtRsudfSEHkDGct`, whose
-- `total_water_storage` maps uniquely to `.../TOTAL_WATER_STORAGE`. No task
-- carries either column. ISI is unmeasured, hence the mapping rather than a
-- blanket null.
--
-- See https://github.com/mintproject/monorepo/issues/106

BEGIN;

-- The old constraints come off first: the rows below cannot be rewritten while a
-- constraint still demands the id scheme they are moving away from.
ALTER TABLE ONLY public.thread DROP CONSTRAINT thread_response_variable_id_fkey;
ALTER TABLE ONLY public.thread DROP CONSTRAINT thread_driving_variable_id_fkey;
ALTER TABLE ONLY public.task DROP CONSTRAINT task_response_variable_id_fkey;
ALTER TABLE ONLY public.task DROP CONSTRAINT task_driving_variable_id_fkey;

-- One row per legacy `variable.id` that some standard variable's label matches.
-- `matches > 1` is the ambiguous case, kept so the UPDATE can skip it.
CREATE TEMP TABLE variable_to_standard_variable ON COMMIT DROP AS
SELECT
    v.id                                  AS legacy_id,
    min(sv.id)                            AS standard_variable_id,
    count(*)                              AS matches
FROM public.variable v
JOIN public.modelcatalog_standard_variable sv ON sv.label = v.id
GROUP BY v.id;

UPDATE public.thread t
SET response_variable_id = m.standard_variable_id
FROM variable_to_standard_variable m
WHERE t.response_variable_id = m.legacy_id AND m.matches = 1;

UPDATE public.thread t
SET driving_variable_id = m.standard_variable_id
FROM variable_to_standard_variable m
WHERE t.driving_variable_id = m.legacy_id AND m.matches = 1;

UPDATE public.task t
SET response_variable_id = m.standard_variable_id
FROM variable_to_standard_variable m
WHERE t.response_variable_id = m.legacy_id AND m.matches = 1;

UPDATE public.task t
SET driving_variable_id = m.standard_variable_id
FROM variable_to_standard_variable m
WHERE t.driving_variable_id = m.legacy_id AND m.matches = 1;

-- Whatever did not map -- unknown label, or a label shared by several standard
-- variables -- cannot satisfy the new constraint. Null it instead of dropping the
-- row: the thread and the task keep everything else they carry.
UPDATE public.thread
SET response_variable_id = NULL
WHERE response_variable_id IS NOT NULL
  AND response_variable_id NOT IN (SELECT id FROM public.modelcatalog_standard_variable);

UPDATE public.thread
SET driving_variable_id = NULL
WHERE driving_variable_id IS NOT NULL
  AND driving_variable_id NOT IN (SELECT id FROM public.modelcatalog_standard_variable);

UPDATE public.task
SET response_variable_id = NULL
WHERE response_variable_id IS NOT NULL
  AND response_variable_id NOT IN (SELECT id FROM public.modelcatalog_standard_variable);

UPDATE public.task
SET driving_variable_id = NULL
WHERE driving_variable_id IS NOT NULL
  AND driving_variable_id NOT IN (SELECT id FROM public.modelcatalog_standard_variable);

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_response_variable_id_fkey
    FOREIGN KEY (response_variable_id) REFERENCES public.modelcatalog_standard_variable(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_driving_variable_id_fkey
    FOREIGN KEY (driving_variable_id) REFERENCES public.modelcatalog_standard_variable(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_response_variable_id_fkey
    FOREIGN KEY (response_variable_id) REFERENCES public.modelcatalog_standard_variable(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_driving_variable_id_fkey
    FOREIGN KEY (driving_variable_id) REFERENCES public.modelcatalog_standard_variable(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMIT;
