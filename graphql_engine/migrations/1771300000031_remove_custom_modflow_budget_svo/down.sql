BEGIN;

INSERT INTO public.modelcatalog_standard_variable (id, label, description, same_as)
VALUES
  ('https://w3id.org/okn/i/mint/wmobley-standard-variable-aquifer-system-volumetric-budget', 'aquifer_system__volumetric_budget', 'Simulated volumetric inflow and outflow terms for groundwater budget accounting.', NULL),
  ('https://w3id.org/okn/i/mint/wmobley/standard-variable/aquifer_system__volumetric_budget', 'aquifer_system__volumetric_budget', 'Simulated volumetric inflow and outflow terms for groundwater budget accounting.', NULL)
ON CONFLICT DO NOTHING;

UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable = 'https://w3id.org/okn/i/mint/wmobley-standard-variable-aquifer-system-volumetric-budget'
WHERE id IN (
  'https://w3id.org/okn/i/mint/7e82b186-11ae-49ae-a2e0-fdd872d39cc4',
  'https://w3id.org/okn/i/mint/1d998c24-ea65-47b4-8526-e579898a6ed8',
  'https://w3id.org/okn/i/mint/wmobley-modflow-6-cell-budget',
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-cell-budget'
);

COMMIT;
