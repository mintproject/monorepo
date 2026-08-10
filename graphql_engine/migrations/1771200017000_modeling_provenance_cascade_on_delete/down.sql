-- Restore ON DELETE RESTRICT on the modeling provenance and permission tables.
-- This reinstates the deadlock described in up.sql: the `user` role can no
-- longer delete a problem statement, a task or a thread by any order of
-- operations. Clients written against the cascade will start reporting the
-- delete as refused, which is the honest failure.

BEGIN;

ALTER TABLE public.problem_statement_provenance
    DROP CONSTRAINT problem_statement_provenance_problem_statement_id_fkey;
ALTER TABLE public.problem_statement_provenance
    ADD CONSTRAINT problem_statement_provenance_problem_statement_id_fkey
    FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statement(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.problem_statement_permission
    DROP CONSTRAINT problem_statement_permission_problem_statement_id_fkey;
ALTER TABLE public.problem_statement_permission
    ADD CONSTRAINT problem_statement_permission_problem_statement_id_fkey
    FOREIGN KEY (problem_statement_id) REFERENCES public.problem_statement(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.task_provenance
    DROP CONSTRAINT task_provenance_task_id_fkey;
ALTER TABLE public.task_provenance
    ADD CONSTRAINT task_provenance_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.task(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.task_permission
    DROP CONSTRAINT task_permission_task_id_fkey;
ALTER TABLE public.task_permission
    ADD CONSTRAINT task_permission_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.task(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.thread_provenance
    DROP CONSTRAINT thread_provenance_thread_id_fkey;
ALTER TABLE public.thread_provenance
    ADD CONSTRAINT thread_provenance_thread_id_fkey
    FOREIGN KEY (thread_id) REFERENCES public.thread(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.thread_permission
    DROP CONSTRAINT thread_permission_thread_id_fkey;
ALTER TABLE public.thread_permission
    ADD CONSTRAINT thread_permission_thread_id_fkey
    FOREIGN KEY (thread_id) REFERENCES public.thread(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMIT;
