BEGIN;

-- Reverse: drop new FK constraints and re-add old FK constraints to model_io(id)

ALTER TABLE execution_data_binding
    DROP CONSTRAINT execution_data_binding_modelcatalog_ds_fkey;

ALTER TABLE execution_result
    DROP CONSTRAINT execution_result_modelcatalog_ds_fkey;

ALTER TABLE execution_data_binding
    ADD CONSTRAINT execution_data_binding_model_io_id_fkey
    FOREIGN KEY (model_io_id) REFERENCES model_io(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE execution_result
    ADD CONSTRAINT execution_result_model_io_id_fkey
    FOREIGN KEY (model_io_id) REFERENCES model_io(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT;

COMMIT;
