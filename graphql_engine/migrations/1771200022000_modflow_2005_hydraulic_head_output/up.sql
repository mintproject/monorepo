-- Advertise the MODFLOW 2005 hds output as the canonical groundwater hydraulic
-- head standard variable.  The existing fixture had only legacy compaction and
-- subsidence presentations on these files, which made the model wizard's exact
-- standard-variable filter return zero models for groundwater__hydraulic_head.
-- On a new schema with no ETL-loaded catalog rows, this data repair is a no-op;
-- catalog population remains a separate ETL or restore operation.

BEGIN;

INSERT INTO public.modelcatalog_variable_presentation
  (id, label, description, has_long_name, has_short_name, has_standard_variable, uses_unit)
SELECT seed.id, seed.label, seed.description, seed.has_long_name, seed.has_short_name,
       seed.has_standard_variable, seed.uses_unit
FROM (VALUES
  ('https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head',
   'Groundwater hydraulic head',
   'Simulated groundwater hydraulic head from MODFLOW 2005 hds output.',
   'Groundwater hydraulic head',
   'hydraulic_head',
   'https://w3id.org/okn/i/mint/19ce71d1-61f4-4aa9-b747-e448a7d7619f',
   NULL)
) AS seed(id, label, description, has_long_name, has_short_name, has_standard_variable, uses_unit)
WHERE EXISTS (
  SELECT 1
  FROM public.modelcatalog_standard_variable
  WHERE id = seed.has_standard_variable
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  has_long_name = EXCLUDED.has_long_name,
  has_short_name = EXCLUDED.has_short_name,
  has_standard_variable = EXCLUDED.has_standard_variable,
  uses_unit = EXCLUDED.uses_unit;

INSERT INTO public.modelcatalog_dataset_specification_presentation (dataset_specification_id, presentation_id)
SELECT seed.dataset_specification_id, seed.presentation_id
FROM (VALUES
  ('https://w3id.org/okn/i/mint/modflow_2005_heads', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head'),
  ('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_advanced_heads', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head'),
  ('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg_heads', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head'),
  ('https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_drought_heads', 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head')
) AS seed(dataset_specification_id, presentation_id)
WHERE EXISTS (
  SELECT 1 FROM public.modelcatalog_dataset_specification ds
  WHERE ds.id = seed.dataset_specification_id
)
AND EXISTS (
  SELECT 1 FROM public.modelcatalog_variable_presentation vp
  WHERE vp.id = seed.presentation_id
)
ON CONFLICT DO NOTHING;

COMMIT;
