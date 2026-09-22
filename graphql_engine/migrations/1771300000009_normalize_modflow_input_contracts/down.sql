BEGIN;

DELETE FROM public.modelcatalog_configuration_input
WHERE configuration_id = 'https://w3id.org/okn/i/mint/90a6c0c2-a43b-4717-adb0-3a5a02737dc9'
  AND input_id IN (
    'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive',
    'https://w3id.org/okn/i/mint/wmobley-modflow-2000-rch-override',
    'https://w3id.org/okn/i/mint/wmobley-modflow-2000-wel-override'
  );

DELETE FROM public.modelcatalog_configuration_input
WHERE configuration_id = 'https://w3id.org/okn/i/mint/54a07d2a-c407-4f41-9c51-3245eabd2e61'
  AND input_id IN (
    'https://w3id.org/okn/i/mint/4cd57da2-9be9-440d-b6b4-5a4ca6edd370',
    'https://w3id.org/okn/i/mint/wmobley-modflow-96-rch-override',
    'https://w3id.org/okn/i/mint/wmobley-modflow-96-wel-override'
  );

DELETE FROM public.modelcatalog_configuration_input
WHERE configuration_id = 'https://w3id.org/okn/i/mint/modflow_2005_cfg'
  AND input_id = 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive';

INSERT INTO public.modelcatalog_configuration_input
  (configuration_id, input_id, is_optional)
VALUES
  ('https://w3id.org/okn/i/mint/90a6c0c2-a43b-4717-adb0-3a5a02737dc9', 'https://w3id.org/okn/i/mint/577fa3fa-6ce2-4b3e-ad07-9773daa49d4c', FALSE),
  ('https://w3id.org/okn/i/mint/90a6c0c2-a43b-4717-adb0-3a5a02737dc9', 'https://w3id.org/okn/i/mint/afd525ba-a1a1-42f7-a743-2aeaf2891f42', FALSE),
  ('https://w3id.org/okn/i/mint/54a07d2a-c407-4f41-9c51-3245eabd2e61', 'https://w3id.org/okn/i/mint/98325827-1b40-4a79-8fc1-599140badb9d', FALSE),
  ('https://w3id.org/okn/i/mint/54a07d2a-c407-4f41-9c51-3245eabd2e61', 'https://w3id.org/okn/i/mint/626ff050-d44f-4d2f-b219-21130c69f517', FALSE),
  ('https://w3id.org/okn/i/mint/54a07d2a-c407-4f41-9c51-3245eabd2e61', 'https://w3id.org/okn/i/mint/4cd57da2-9be9-440d-b6b4-5a4ca6edd370', FALSE)
ON CONFLICT DO NOTHING;

UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable =
  'https://w3id.org/okn/i/mint/GROUNDWATER_WELL__RECHARGE_VOLUME_FLUX'
WHERE id = 'https://w3id.org/okn/i/mint/modflow2005_q';

UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable = NULL
WHERE id IN (
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-96-simulation-archive',
  'https://w3id.org/okn/i/mint/b08fd7d3-24c2-48cc-83be-a52b73fdf212'
);

UPDATE public.modelcatalog_dataset_specification
SET has_format = NULL, "position" = NULL
WHERE id = 'https://w3id.org/okn/i/mint/4cd57da2-9be9-440d-b6b4-5a4ca6edd370';

DELETE FROM public.modelcatalog_dataset_specification_presentation
WHERE dataset_specification_id IN (
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-wel-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-rch-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-96-wel-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-96-rch-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive'
);

DELETE FROM public.modelcatalog_dataset_specification
WHERE id IN (
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-wel-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-rch-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-96-wel-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-96-rch-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive'
);

DELETE FROM public.modelcatalog_variable_presentation
WHERE id IN (
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-wel-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-rch-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-96-wel-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-96-rch-override',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive'
);

COMMIT;
