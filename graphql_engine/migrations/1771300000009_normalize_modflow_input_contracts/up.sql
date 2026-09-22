BEGIN;

-- All four supported MODFLOW families use the same semantic input contract.
-- Archive inputs contain the complete model package; WEL and RCH inputs are
-- explicit override candidates for problem formulation and adapter planning.
INSERT INTO public.modelcatalog_standard_variable
  (id, label, description, same_as)
VALUES
  (
    'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-simulation-archive',
    'groundwater_model__simulation_archive',
    'Optional ZIP archive containing a complete groundwater model simulation and support files.',
    NULL
  ),
  (
    'https://w3id.org/okn/i/mint/61e86974-f1bb-406c-ae52-f6c6eccb6c59',
    'groundwater_well__volume_flow_rate',
    NULL,
    NULL
  ),
  (
    'https://w3id.org/okn/i/mint/GROUNDWATER__RECHARGE_VOLUME_FLUX',
    'groundwater__recharge_volume_flux',
    NULL,
    NULL
  )
ON CONFLICT DO NOTHING;

-- Existing family archive presentations were registered without their SVO
-- mapping. Keep their stable IDs and make the mapping explicit.
UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable =
  'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-simulation-archive'
WHERE id IN (
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-6-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-96-simulation-archive',
  'https://w3id.org/okn/i/mint/b08fd7d3-24c2-48cc-83be-a52b73fdf212'
);

INSERT INTO public.modelcatalog_variable_presentation
  (id, label, description, has_long_name, has_short_name, has_standard_variable, uses_unit)
VALUES
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-2000-wel-override',
    'MODFLOW 2000 well override',
    'Optional replacement MODFLOW 2000 WEL package input.',
    'MODFLOW 2000 well override',
    'wel_override',
    'https://w3id.org/okn/i/mint/61e86974-f1bb-406c-ae52-f6c6eccb6c59',
    NULL
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-2000-rch-override',
    'MODFLOW 2000 recharge override',
    'Optional replacement MODFLOW 2000 recharge package input.',
    'MODFLOW 2000 recharge override',
    'rch_override',
    'https://w3id.org/okn/i/mint/GROUNDWATER__RECHARGE_VOLUME_FLUX',
    NULL
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-96-wel-override',
    'MODFLOW 96 well override',
    'Optional replacement MODFLOW 96 WEL package input.',
    'MODFLOW 96 well override',
    'wel_override',
    'https://w3id.org/okn/i/mint/61e86974-f1bb-406c-ae52-f6c6eccb6c59',
    NULL
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-96-rch-override',
    'MODFLOW 96 recharge override',
    'Optional replacement MODFLOW 96 recharge package input.',
    'MODFLOW 96 recharge override',
    'rch_override',
    'https://w3id.org/okn/i/mint/GROUNDWATER__RECHARGE_VOLUME_FLUX',
    NULL
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive',
    'MODFLOW 2005 simulation archive',
    'ZIP archive containing a complete MODFLOW 2005 simulation and support files.',
    'MODFLOW 2005 simulation archive',
    'simulation_archive',
    'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-simulation-archive',
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET has_standard_variable = EXCLUDED.has_standard_variable;

INSERT INTO public.modelcatalog_dataset_specification
  (id, label, description, has_format, has_dimensionality, "position")
VALUES
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive',
    'MODFLOW 2000 simulation archive',
    'ZIP archive containing a complete MODFLOW 2000 simulation and support files.',
    'zip',
    NULL,
    '1'
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-2000-wel-override',
    'MODFLOW 2000 well override',
    'Optional replacement MODFLOW 2000 WEL package input.',
    NULL,
    NULL,
    '3'
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-2000-rch-override',
    'MODFLOW 2000 recharge override',
    'Optional replacement MODFLOW 2000 recharge package input.',
    NULL,
    NULL,
    '2'
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-96-wel-override',
    'MODFLOW 96 well override',
    'Optional replacement MODFLOW 96 WEL package input.',
    NULL,
    NULL,
    '3'
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-96-rch-override',
    'MODFLOW 96 recharge override',
    'Optional replacement MODFLOW 96 recharge package input.',
    NULL,
    NULL,
    '2'
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive',
    'MODFLOW 2005 simulation archive',
    'ZIP archive containing a complete MODFLOW 2005 simulation and support files.',
    'zip',
    NULL,
    '1'
  )
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    has_format = EXCLUDED.has_format,
    "position" = EXCLUDED."position";

UPDATE public.modelcatalog_dataset_specification
SET has_format = 'zip', "position" = '1'
WHERE id = 'https://w3id.org/okn/i/mint/4cd57da2-9be9-440d-b6b4-5a4ca6edd370';

INSERT INTO public.modelcatalog_dataset_specification_presentation
  (dataset_specification_id, presentation_id)
VALUES
  ('https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive', 'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive'),
  ('https://w3id.org/okn/i/mint/wmobley-modflow-2000-wel-override', 'https://w3id.org/okn/i/mint/wmobley-modflow-2000-wel-override'),
  ('https://w3id.org/okn/i/mint/wmobley-modflow-2000-rch-override', 'https://w3id.org/okn/i/mint/wmobley-modflow-2000-rch-override'),
  ('https://w3id.org/okn/i/mint/wmobley-modflow-96-wel-override', 'https://w3id.org/okn/i/mint/wmobley-modflow-96-wel-override'),
  ('https://w3id.org/okn/i/mint/wmobley-modflow-96-rch-override', 'https://w3id.org/okn/i/mint/wmobley-modflow-96-rch-override'),
  ('https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive')
ON CONFLICT DO NOTHING;

-- MODFLOW 2000 and MODFLOW 96 previously exposed only generic file bundles.
-- The archive now carries the complete simulation, with explicit semantic
-- override candidates matching MF6.
DELETE FROM public.modelcatalog_configuration_input
WHERE configuration_id = 'https://w3id.org/okn/i/mint/90a6c0c2-a43b-4717-adb0-3a5a02737dc9'
  AND input_id IN (
    'https://w3id.org/okn/i/mint/afd525ba-a1a1-42f7-a743-2aeaf2891f42',
    'https://w3id.org/okn/i/mint/577fa3fa-6ce2-4b3e-ad07-9773daa49d4c'
  );

DELETE FROM public.modelcatalog_configuration_input
WHERE configuration_id = 'https://w3id.org/okn/i/mint/54a07d2a-c407-4f41-9c51-3245eabd2e61'
  AND input_id IN (
    'https://w3id.org/okn/i/mint/98325827-1b40-4a79-8fc1-599140badb9d',
    'https://w3id.org/okn/i/mint/626ff050-d44f-4d2f-b219-21130c69f517'
  );

INSERT INTO public.modelcatalog_configuration_input
  (configuration_id, input_id, is_optional)
VALUES
  ('https://w3id.org/okn/i/mint/90a6c0c2-a43b-4717-adb0-3a5a02737dc9', 'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive', FALSE),
  ('https://w3id.org/okn/i/mint/90a6c0c2-a43b-4717-adb0-3a5a02737dc9', 'https://w3id.org/okn/i/mint/wmobley-modflow-2000-rch-override', FALSE),
  ('https://w3id.org/okn/i/mint/90a6c0c2-a43b-4717-adb0-3a5a02737dc9', 'https://w3id.org/okn/i/mint/wmobley-modflow-2000-wel-override', FALSE),
  ('https://w3id.org/okn/i/mint/54a07d2a-c407-4f41-9c51-3245eabd2e61', 'https://w3id.org/okn/i/mint/4cd57da2-9be9-440d-b6b4-5a4ca6edd370', FALSE),
  ('https://w3id.org/okn/i/mint/54a07d2a-c407-4f41-9c51-3245eabd2e61', 'https://w3id.org/okn/i/mint/wmobley-modflow-96-rch-override', FALSE),
  ('https://w3id.org/okn/i/mint/54a07d2a-c407-4f41-9c51-3245eabd2e61', 'https://w3id.org/okn/i/mint/wmobley-modflow-96-wel-override', FALSE),
  ('https://w3id.org/okn/i/mint/modflow_2005_cfg', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive', FALSE)
ON CONFLICT DO NOTHING;

-- Correct the existing MODFLOW 2005 WEL semantic mapping. Its RCH mapping is
-- already correct and the package inputs remain available to the runtime.
UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable =
  'https://w3id.org/okn/i/mint/61e86974-f1bb-406c-ae52-f6c6eccb6c59'
WHERE id = 'https://w3id.org/okn/i/mint/modflow2005_q';

COMMIT;
