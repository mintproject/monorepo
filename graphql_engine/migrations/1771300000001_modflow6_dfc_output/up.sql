-- Register the MODFLOW 6 CBC output contract used by the SVO adapter demo.
-- The output is intentionally format-only: the adapter graph supplies the
-- spring__volume_flow_rate meaning downstream of cbc-mf6.

BEGIN;

INSERT INTO public.modelcatalog_standard_variable (id, label, description)
VALUES (
  'https://w3id.org/okn/i/mint/spring__volume_flow_rate',
  'spring__volume_flow_rate',
  'Volume flow rate from a modeled spring.'
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;

INSERT INTO public.modelcatalog_dataset_specification
  (id, label, description, has_format, has_dimensionality, position)
VALUES (
  'https://w3id.org/okn/i/mint/modflow6_cbc_output',
  'MODFLOW 6 cell-by-cell budget',
  'MODFLOW 6 cell-by-cell budget output consumed by the SVO adapter chain.',
  'cbc-mf6',
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  has_format = EXCLUDED.has_format;

INSERT INTO public.modelcatalog_configuration_output (configuration_id, output_id)
SELECT
  'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
  'https://w3id.org/okn/i/mint/modflow6_cbc_output'
WHERE EXISTS (
  SELECT 1
  FROM public.modelcatalog_configuration
  WHERE id = 'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488'
)
ON CONFLICT DO NOTHING;

COMMIT;
