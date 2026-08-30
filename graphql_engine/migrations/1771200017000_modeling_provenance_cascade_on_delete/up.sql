-- Let a problem statement, task or thread carry its provenance and permission
-- rows to the grave, instead of requiring the client to remove them first.
--
-- The `user` role may delete one of these rows only if the row still has a
-- CREATE provenance event from that user:
--
--     filter: { events: { _and: [ {event: {_eq: CREATE}}, {userid: {_eq: X-Hasura-User-Id}} ] } }
--
-- With ON DELETE RESTRICT that permission was unsatisfiable. Deleting the
-- provenance first (what every client does) removed the row's own delete
-- permission, so the delete matched 0 rows and returned success. Deleting the
-- row first was refused by this constraint. Neither order could work.
--
-- CASCADE breaks the tie: the client deletes only the row, while its CREATE
-- event is still there to authorise the delete, and Postgres removes the
-- dependants. Provenance and permission rows have no life of their own once
-- their subject is gone, so cascading is also what they mean.
--
-- See https://github.com/mintproject/monorepo/issues/99

BEGIN;

ALTER TABLE public.problem_statement_provenance
    DROP CONSTRAINT problem_statement_provenance_problem_statement_id_fkey;
ALTER TABLE public.problem_statement_provenance
    ADD CONSTRAINT problem_statement_provenance_problem_statement_id_fkey
    FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statement(id)
    ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE public.problem_statement_permission
    DROP CONSTRAINT problem_statement_permission_problem_statement_id_fkey;
ALTER TABLE public.problem_statement_permission
    ADD CONSTRAINT problem_statement_permission_problem_statement_id_fkey
    FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statement(id)
    ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE public.task_provenance
    DROP CONSTRAINT task_provenance_task_id_fkey;
ALTER TABLE public.task_provenance
    ADD CONSTRAINT task_provenance_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.task(id)
    ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE public.task_permission
    DROP CONSTRAINT task_permission_task_id_fkey;
ALTER TABLE public.task_permission
    ADD CONSTRAINT task_permission_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.task(id)
    ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE public.thread_provenance
    DROP CONSTRAINT thread_provenance_thread_id_fkey;
ALTER TABLE public.thread_provenance
    ADD CONSTRAINT thread_provenance_thread_id_fkey
    FOREIGN KEY (thread_id) REFERENCES public.thread(id)
    ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE public.thread_permission
    DROP CONSTRAINT thread_permission_thread_id_fkey;
ALTER TABLE public.thread_permission
    ADD CONSTRAINT thread_permission_thread_id_fkey
    FOREIGN KEY (thread_id) REFERENCES public.thread(id)
    ON UPDATE RESTRICT ON DELETE CASCADE;

COMMIT;
