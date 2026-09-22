BEGIN;

DELETE FROM public.modelcatalog_dataset_specification_presentation
WHERE (dataset_specification_id, presentation_id) IN (
  ('https://w3id.org/okn/i/mint/modflow_2005_cbb', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-cell-budget'),
  ('https://w3id.org/okn/i/mint/modflow_2005_ddown', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-drawdown'),
  ('https://w3id.org/okn/i/mint/modflow6_cbc_output', 'https://w3id.org/okn/i/mint/wmobley-modflow-6-cell-budget')
);

DELETE FROM public.modelcatalog_variable_presentation
WHERE id IN (
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-cell-budget',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-drawdown'
);

UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable = NULL
WHERE id IN (
  'https://w3id.org/okn/i/mint/7e82b186-11ae-49ae-a2e0-fdd872d39cc4',
  'https://w3id.org/okn/i/mint/1d998c24-ea65-47b4-8526-e579898a6ed8',
  'https://w3id.org/okn/i/mint/2bddcbf0-6235-4dbd-b94a-6c3284d72897',
  'https://w3id.org/okn/i/mint/de1bc743-cbc0-4940-9933-124fb5f895ad',
  'https://w3id.org/okn/i/mint/fedd3f44-4045-42fd-bbd0-a8c67ae2e1af',
  'https://w3id.org/okn/i/mint/43ae2275-6ba6-408c-a737-7b48f29827e8',
  'https://w3id.org/okn/i/mint/wmobley-modflow-6-cell-budget'
);

UPDATE public.modelcatalog_dataset_specification
SET label = 'Cell budget output', description = NULL
WHERE id = 'https://w3id.org/okn/i/mint/6b16c7bc-25ef-4afb-bc4b-35b10cc409c9';

UPDATE public.modelcatalog_dataset_specification
SET label = 'Drawdown output', description = NULL, has_format = NULL
WHERE id = 'https://w3id.org/okn/i/mint/9aadd1a3-cd8c-4f52-8eda-4b897e1d786f';

UPDATE public.modelcatalog_dataset_specification
SET label = 'Hydraulic head output', description = NULL, has_format = NULL
WHERE id = 'https://w3id.org/okn/i/mint/d9caf5a9-335e-4883-a50b-699f387cf34a';

UPDATE public.modelcatalog_dataset_specification
SET label = 'Groundwater drawdown', description = 'Simulated drawdown relative to initial or reference hydraulic head.', has_format = NULL
WHERE id = 'https://w3id.org/okn/i/mint/dce0bbf7-c09e-4588-9ec2-cb4fd932a191';

UPDATE public.modelcatalog_dataset_specification
SET label = 'Groundwater hydraulic head', description = 'Simulated groundwater hydraulic head from MODFLOW-96 output.', has_format = NULL
WHERE id = 'https://w3id.org/okn/i/mint/9381a5d1-41d4-4380-a43d-078586efeffc';

COMMIT;
