BEGIN;

DELETE FROM public.modelcatalog_dataset_specification_presentation
WHERE presentation_id IN (
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-drain-package',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hfb6-package',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-output-control',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-sip-package'
);

DELETE FROM public.modelcatalog_variable_presentation
WHERE id IN (
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-drain-package',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hfb6-package',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-output-control',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-sip-package'
);

INSERT INTO public.modelcatalog_configuration_input (configuration_id, input_id, is_optional)
VALUES
  ('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg', 'https://w3id.org/okn/i/mint/270d3555-59be-4221-816d-2b07e4e37c4b', false),
  ('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg', 'https://w3id.org/okn/i/mint/2b98cbd2-8e07-4c09-9c4e-82869368f077', false),
  ('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg', 'https://w3id.org/okn/i/mint/34866637-4422-4a19-9b13-eb0bb5f32d33', false),
  ('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg', 'https://w3id.org/okn/i/mint/3c9c6904-f365-46c1-9026-c4f628a3a7d9', false),
  ('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg', 'https://w3id.org/okn/i/mint/3d50ac40-a7d9-4c37-ae7a-c8218e66e622', false),
  ('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg', 'https://w3id.org/okn/i/mint/6259dcf0-4c83-4336-b339-4a86ba39eec8', false),
  ('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg', 'https://w3id.org/okn/i/mint/a45df071-c539-40cf-bc3e-27e96823c1e4', false)
ON CONFLICT DO NOTHING;

COMMIT;
