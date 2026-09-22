BEGIN;

-- The fixture and the earlier MODFLOW 2005 repair created the canonical head
-- presentation, but attached it to a legacy duplicate standard variable.  The
-- model wizard compares standard-variable IDs exactly, so that left the same
-- visible outcome split across incompatible graph identities.
INSERT INTO public.modelcatalog_standard_variable
  (id, label, description, same_as)
VALUES (
  'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-hydraulic-head',
  'groundwater__hydraulic_head',
  'Groundwater hydraulic head produced by a groundwater model.',
  NULL
)
ON CONFLICT DO NOTHING;

-- This presentation is attached to the MODFLOW 2005 hydraulic-head output for
-- the family configuration and its Barton Springs setups.  Update the
-- existing row in place so the migration is safe on an already-populated
-- database and preserves all dataset/configuration relationships.
UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable =
  'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-hydraulic-head'
WHERE id =
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head';

COMMIT;
