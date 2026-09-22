BEGIN;

-- Define the optional package overrides before relating them to the
-- configuration. These IDs are intentionally separate from the complete
-- simulation archive so the UI and adapter can expose targeted overrides.
INSERT INTO public.modelcatalog_dataset_specification
  (id, label, description, has_format, has_dimensionality, "position")
VALUES
  (
    'https://w3id.org/okn/i/mint/modflow6_input_wel',
    'MODFLOW 6 well override',
    'Optional MODFLOW 6 well package override for a complete simulation archive.',
    'wel',
    NULL,
    2
  ),
  (
    'https://w3id.org/okn/i/mint/modflow6_input_rch',
    'MODFLOW 6 recharge override',
    'Optional MODFLOW 6 recharge package override for a complete simulation archive.',
    'rch',
    NULL,
    3
  )
ON CONFLICT DO NOTHING;

-- The complete MODFLOW 6 archive is the canonical model bundle. Remove the
-- older generic archive, legacy WEL/RCH rows, and duplicate RCHA package rows
-- before adding the three canonical relationships below.
DELETE FROM public.modelcatalog_configuration_input
WHERE configuration_id =
  'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488'
  AND input_id IN (
    'https://w3id.org/okn/i/mint/modflow6_input_simulation-archive',
    'https://w3id.org/okn/i/mint/03621b4b-0888-4b64-b963-17fa310130d8',
    'https://w3id.org/okn/i/mint/bf0761eb-2187-42df-a457-174a4af418a5',
    'https://w3id.org/okn/i/mint/modflow6_input_rcha',
    'https://w3id.org/okn/i/mint/modflow6_input_rcha-02',
    'https://w3id.org/okn/i/mint/modflow6_input_rcha-03'
  );

WITH canonical_inputs (configuration_id, input_id, is_optional) AS (
  VALUES
  (
    'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
    'https://w3id.org/okn/i/mint/wmobley-modflow-6-simulation-archive',
    FALSE
  ),
  (
    'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
    'https://w3id.org/okn/i/mint/modflow6_input_wel',
    TRUE
  ),
  (
    'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
    'https://w3id.org/okn/i/mint/modflow6_input_rch',
    TRUE
  )
)
INSERT INTO public.modelcatalog_configuration_input
  (configuration_id, input_id, is_optional)
SELECT canonical.configuration_id, canonical.input_id, canonical.is_optional
FROM canonical_inputs AS canonical
JOIN public.modelcatalog_configuration AS configuration
  ON configuration.id = canonical.configuration_id
JOIN public.modelcatalog_dataset_specification AS input
  ON input.id = canonical.input_id
ON CONFLICT (configuration_id, input_id) DO UPDATE
SET is_optional = EXCLUDED.is_optional;

COMMIT;
