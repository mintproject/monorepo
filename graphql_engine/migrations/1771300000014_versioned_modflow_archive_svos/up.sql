BEGIN;

-- A complete simulation archive is only consumable by model engines that
-- understand its package/version contract. Keep the previous generic
-- standard variable for rollback and historical data, but make each canonical
-- MODFLOW configuration request its compatible archive label.
INSERT INTO public.modelcatalog_standard_variable
  (id, label, description, same_as)
VALUES
  (
    'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow6-simulation-archive',
    'groundwater_model_modflow6_simulation_archive',
    'ZIP archive containing a complete MODFLOW 6 simulation and support files.',
    NULL
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow2000-simulation-archive',
    'groundwater_model_modflow2000_simulation_archive',
    'ZIP archive containing a complete MODFLOW 2000 simulation and support files.',
    NULL
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow2005-simulation-archive',
    'groundwater_model_modflow2005_simulation_archive',
    'ZIP archive containing a complete MODFLOW 2005 simulation and support files.',
    NULL
  ),
  (
    'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow96-simulation-archive',
    'groundwater_model_modflow96_simulation_archive',
    'ZIP archive containing a complete MODFLOW 96 simulation and support files.',
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description;

UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable = CASE id
  WHEN 'https://w3id.org/okn/i/mint/wmobley-modflow-6-simulation-archive'
    THEN 'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow6-simulation-archive'
  WHEN 'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive'
    THEN 'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow2000-simulation-archive'
  WHEN 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive'
    THEN 'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow2005-simulation-archive'
  WHEN 'https://w3id.org/okn/i/mint/wmobley-modflow-96-simulation-archive'
    THEN 'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow96-simulation-archive'
  WHEN 'https://w3id.org/okn/i/mint/b08fd7d3-24c2-48cc-83be-a52b73fdf212'
    THEN 'https://w3id.org/okn/i/mint/wmobley-standard-variable-groundwater-model-modflow96-simulation-archive'
END
WHERE id IN (
  'https://w3id.org/okn/i/mint/wmobley-modflow-6-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2000-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-simulation-archive',
  'https://w3id.org/okn/i/mint/wmobley-modflow-96-simulation-archive',
  'https://w3id.org/okn/i/mint/b08fd7d3-24c2-48cc-83be-a52b73fdf212'
);

COMMIT;
