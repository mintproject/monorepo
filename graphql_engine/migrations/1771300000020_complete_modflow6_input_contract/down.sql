BEGIN;

-- Restore the relationships removed by this cleanup.
WITH restored_inputs (configuration_id, input_id, is_optional) AS (
  VALUES
  (
    'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
    'https://w3id.org/okn/i/mint/modflow6_input_simulation-archive',
    FALSE
  ),
  (
    'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
    'https://w3id.org/okn/i/mint/03621b4b-0888-4b64-b963-17fa310130d8',
    TRUE
  ),
  (
    'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
    'https://w3id.org/okn/i/mint/bf0761eb-2187-42df-a457-174a4af418a5',
    TRUE
  ),
  (
    'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
    'https://w3id.org/okn/i/mint/modflow6_input_rcha',
    TRUE
  ),
  (
    'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
    'https://w3id.org/okn/i/mint/modflow6_input_rcha-02',
    TRUE
  ),
  (
    'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
    'https://w3id.org/okn/i/mint/modflow6_input_rcha-03',
    TRUE
  )
)
INSERT INTO public.modelcatalog_configuration_input
  (configuration_id, input_id, is_optional)
SELECT restored.configuration_id, restored.input_id, restored.is_optional
FROM restored_inputs AS restored
JOIN public.modelcatalog_configuration AS configuration
  ON configuration.id = restored.configuration_id
JOIN public.modelcatalog_dataset_specification AS input
  ON input.id = restored.input_id
ON CONFLICT (configuration_id, input_id) DO UPDATE
SET is_optional = EXCLUDED.is_optional;

COMMIT;
