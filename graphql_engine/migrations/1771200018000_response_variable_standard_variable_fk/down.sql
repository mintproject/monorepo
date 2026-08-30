-- Reverse of up.sql: point the indicator columns back at `public.variable`.
--
-- The mapping runs the other way, again by label: a standard variable id becomes
-- the `variable.id` that equals its label, when such a row exists. Standard
-- variables with no counterpart in the frozen `variable` table -- 431 of 668 at
-- TACC -- have nowhere to go, so they are nulled. This direction is therefore
-- lossy by construction, which is the point of the migration.

BEGIN;

-- Off first, for the same reason as in up.sql.
ALTER TABLE ONLY public.thread DROP CONSTRAINT thread_response_variable_id_fkey;
ALTER TABLE ONLY public.thread DROP CONSTRAINT thread_driving_variable_id_fkey;
ALTER TABLE ONLY public.task DROP CONSTRAINT task_response_variable_id_fkey;
ALTER TABLE ONLY public.task DROP CONSTRAINT task_driving_variable_id_fkey;

UPDATE public.thread t
SET response_variable_id = sv.label
FROM public.modelcatalog_standard_variable sv
WHERE t.response_variable_id = sv.id
  AND EXISTS (SELECT 1 FROM public.variable v WHERE v.id = sv.label);

UPDATE public.thread t
SET driving_variable_id = sv.label
FROM public.modelcatalog_standard_variable sv
WHERE t.driving_variable_id = sv.id
  AND EXISTS (SELECT 1 FROM public.variable v WHERE v.id = sv.label);

UPDATE public.task t
SET response_variable_id = sv.label
FROM public.modelcatalog_standard_variable sv
WHERE t.response_variable_id = sv.id
  AND EXISTS (SELECT 1 FROM public.variable v WHERE v.id = sv.label);

UPDATE public.task t
SET driving_variable_id = sv.label
FROM public.modelcatalog_standard_variable sv
WHERE t.driving_variable_id = sv.id
  AND EXISTS (SELECT 1 FROM public.variable v WHERE v.id = sv.label);

UPDATE public.thread
SET response_variable_id = NULL
WHERE response_variable_id IS NOT NULL
  AND response_variable_id NOT IN (SELECT id FROM public.variable);

UPDATE public.thread
SET driving_variable_id = NULL
WHERE driving_variable_id IS NOT NULL
  AND driving_variable_id NOT IN (SELECT id FROM public.variable);

UPDATE public.task
SET response_variable_id = NULL
WHERE response_variable_id IS NOT NULL
  AND response_variable_id NOT IN (SELECT id FROM public.variable);

UPDATE public.task
SET driving_variable_id = NULL
WHERE driving_variable_id IS NOT NULL
  AND driving_variable_id NOT IN (SELECT id FROM public.variable);

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_response_variable_id_fkey
    FOREIGN KEY (response_variable_id) REFERENCES public.variable(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.thread
    ADD CONSTRAINT thread_driving_variable_id_fkey
    FOREIGN KEY (driving_variable_id) REFERENCES public.variable(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_response_variable_id_fkey
    FOREIGN KEY (response_variable_id) REFERENCES public.variable(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE ONLY public.task
    ADD CONSTRAINT task_driving_variable_id_fkey
    FOREIGN KEY (driving_variable_id) REFERENCES public.variable(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMIT;
