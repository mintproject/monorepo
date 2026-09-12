-- Advertise the MODFLOW 2005 hds output as the canonical groundwater hydraulic
-- head standard variable.  The existing fixture had only legacy compaction and
-- subsidence presentations on these files, which made the model wizard's exact
-- standard-variable filter return zero models for groundwater__hydraulic_head.
--
-- This is a data repair, not a schema change.  It runs before the catalog rows
-- exist on a cold start: `hasura migrate apply` runs first, and the catalog
-- fixture loads after it.  So every statement selects its own foreign key
-- target and inserts nothing when the target is absent.  On an empty catalog
-- the migration is a no-op, and the fixture carries the same rows itself.

BEGIN;

INSERT INTO public.modelcatalog_variable_presentation
  (id, label, description, has_long_name, has_short_name, has_standard_variable, uses_unit)
SELECT
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head',
  'Groundwater hydraulic head',
  'Simulated groundwater hydraulic head from MODFLOW 2005 hds output.',
  'Groundwater hydraulic head',
  'hydraulic_head',
  sv.id,
  NULL
FROM public.modelcatalog_standard_variable AS sv
WHERE sv.id = 'https://w3id.org/okn/i/mint/19ce71d1-61f4-4aa9-b747-e448a7d7619f'
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  has_long_name = EXCLUDED.has_long_name,
  has_short_name = EXCLUDED.has_short_name,
  has_standard_variable = EXCLUDED.has_standard_variable,
  uses_unit = EXCLUDED.uses_unit;

INSERT INTO public.modelcatalog_dataset_specification_presentation
  (dataset_specification_id, presentation_id)
SELECT ds.id, vp.id
FROM public.modelcatalog_dataset_specification AS ds
CROSS JOIN public.modelcatalog_variable_presentation AS vp
WHERE vp.id = 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head'
  AND ds.id IN (
    'https://w3id.org/okn/i/mint/modflow_2005_heads',
    'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_advanced_heads',
    'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_heads',
    'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_drought_heads'
  )
ON CONFLICT DO NOTHING;

COMMIT;
