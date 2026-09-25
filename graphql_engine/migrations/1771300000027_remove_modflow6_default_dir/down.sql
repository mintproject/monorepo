BEGIN;

INSERT INTO public.modelcatalog_parameter
  (id, label, description, has_data_type, has_default_value,
   has_minimum_accepted_value, has_maximum_accepted_value, has_fixed_value,
   "position", parameter_type, has_accepted_values)
VALUES (
  'https://w3id.org/okn/i/mint/0d8f8ea2-e7d7-4360-ba53-aa54f2c62b0c',
  'mf6DefaultDir',
  'Default baseline MF6 input directory used when files are not present in uploaded inputs.',
  'string',
  '/corral-repl/tacc/aci/PT2050/projects/PTDATAX-272/twdb_gam_collection/Carrizo-Wilcox_Aquifer_central_portion_GAM_version_3.02/Model_File/czwx_c_qcsp_v3.02_model_files/czwx_c_qcsp_v3.02_model_files/GMA12_Modified_MODFLOW/Modified_GAM/gwv-modflow-usg-Modified',
  NULL, NULL, NULL, 1, 'standard', NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.modelcatalog_configuration_parameter
  (configuration_id, parameter_id)
SELECT
  'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
  'https://w3id.org/okn/i/mint/0d8f8ea2-e7d7-4360-ba53-aa54f2c62b0c'
WHERE EXISTS (
  SELECT 1
  FROM public.modelcatalog_configuration
  WHERE id = 'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488'
)
ON CONFLICT DO NOTHING;

COMMIT;
