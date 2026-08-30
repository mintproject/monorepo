BEGIN;

-- Reverse: drop new FK constraint and re-add old FK constraint to model_io(id)

ALTER TABLE thread_model_io
    DROP CONSTRAINT thread_model_io_modelcatalog_ds_fkey;

ALTER TABLE thread_model_io
    ADD CONSTRAINT thread_model_io_model_io_id_fkey
    FOREIGN KEY (model_io_id) REFERENCES model_io(id)
    DEFERRABLE INITIALLY DEFERRED;

COMMIT;
