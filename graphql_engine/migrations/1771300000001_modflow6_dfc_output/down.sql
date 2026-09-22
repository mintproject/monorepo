BEGIN;

DELETE FROM public.modelcatalog_configuration_output
WHERE configuration_id = 'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488'
  AND output_id = 'https://w3id.org/okn/i/mint/modflow6_cbc_output';

DELETE FROM public.modelcatalog_dataset_specification
WHERE id = 'https://w3id.org/okn/i/mint/modflow6_cbc_output';

DELETE FROM public.modelcatalog_standard_variable
WHERE id = 'https://w3id.org/okn/i/mint/spring__volume_flow_rate';

COMMIT;
