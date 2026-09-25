BEGIN;

-- MODFLOW 6 now requires the selected simulation.zip archive. Remove the
-- legacy configuration association that exposed a host-specific baseline
-- directory. Keep the parameter row itself: historical execution bindings
-- may still reference it and model_parameter_id is non-null.
DELETE FROM public.modelcatalog_configuration_parameter
WHERE configuration_id =
  'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488'
  AND parameter_id =
  'https://w3id.org/okn/i/mint/0d8f8ea2-e7d7-4360-ba53-aa54f2c62b0c';

COMMIT;
