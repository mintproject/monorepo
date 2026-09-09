-- Restore the Barton Springs MODFLOW-2005 setup to the nine inputs used by the
-- Tapis model and make every package input discoverable in the data catalog.

BEGIN;

DELETE FROM public.modelcatalog_configuration_input
WHERE configuration_id = 'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg'
  AND input_id IN (
    'https://w3id.org/okn/i/mint/270d3555-59be-4221-816d-2b07e4e37c4b',
    'https://w3id.org/okn/i/mint/2b98cbd2-8e07-4c09-9c4e-82869368f077',
    'https://w3id.org/okn/i/mint/34866637-4422-4a19-9b13-eb0bb5f32d33',
    'https://w3id.org/okn/i/mint/3c9c6904-f365-46c1-9026-c4f628a3a7d9',
    'https://w3id.org/okn/i/mint/3d50ac40-a7d9-4c37-ae7a-c8218e66e622',
    'https://w3id.org/okn/i/mint/6259dcf0-4c83-4336-b339-4a86ba39eec8',
    'https://w3id.org/okn/i/mint/a45df071-c539-40cf-bc3e-27e96823c1e4'
  );

INSERT INTO public.modelcatalog_variable_presentation
  (id, label, description, has_long_name, has_short_name, has_standard_variable, uses_unit)
VALUES
  ('https://w3id.org/okn/i/mint/wmobley-modflow-2005-drain-package',
   'MODFLOW 2005 drain package',
   'MODFLOW 2005 drain package input file.',
   'MODFLOW 2005 drain package', 'drain_package_file',
   'https://w3id.org/okn/i/mint/28d21c91-fea3-4efa-9a4e-602f4590081d', NULL),
  ('https://w3id.org/okn/i/mint/wmobley-modflow-2005-hfb6-package',
   'MODFLOW 2005 HFB6 package',
   'MODFLOW 2005 horizontal-flow-barrier package input file.',
   'MODFLOW 2005 HFB6 package', 'hfb6',
   'https://w3id.org/okn/i/mint/b498b989-329f-4240-96be-5edf578b0fa3', NULL),
  ('https://w3id.org/okn/i/mint/wmobley-modflow-2005-output-control',
   'MODFLOW 2005 output control',
   'MODFLOW 2005 output-control package input file.',
   'MODFLOW 2005 output control', 'output_control_file',
   'https://w3id.org/okn/i/mint/c6a8d6e8-3761-4bce-bf6b-51b0bcde6e39', NULL),
  ('https://w3id.org/okn/i/mint/wmobley-modflow-2005-sip-package',
   'MODFLOW 2005 SIP package',
   'MODFLOW 2005 strongly implicit procedure package input file.',
   'MODFLOW 2005 SIP package', 'sip',
   'https://w3id.org/okn/i/mint/7fdad32c-2107-4717-8b03-c3f152336e1f', NULL)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  has_long_name = EXCLUDED.has_long_name,
  has_short_name = EXCLUDED.has_short_name,
  has_standard_variable = EXCLUDED.has_standard_variable,
  uses_unit = EXCLUDED.uses_unit;

INSERT INTO public.modelcatalog_dataset_specification_presentation
  (dataset_specification_id, presentation_id)
SELECT format('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_%s_%s', variant, package), presentation_id
FROM (VALUES
  ('advanced', 'Drn', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-drain-package'),
  ('advanced', 'Hfb', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hfb6-package'),
  ('advanced', 'Oc',  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-output-control'),
  ('advanced', 'Sip', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-sip-package'),
  ('avg',      'Drn', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-drain-package'),
  ('avg',      'Hfb', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hfb6-package'),
  ('avg',      'Oc',  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-output-control'),
  ('avg',      'Sip', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-sip-package'),
  ('drought',  'Drn', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-drain-package'),
  ('drought',  'Hfb', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hfb6-package'),
  ('drought',  'Oc',  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-output-control'),
  ('drought',  'Sip', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-sip-package')
) AS mappings(variant, package, presentation_id)
ON CONFLICT DO NOTHING;

COMMIT;
