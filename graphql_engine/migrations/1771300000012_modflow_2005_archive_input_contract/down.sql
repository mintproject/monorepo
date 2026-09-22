BEGIN;

-- Restore the package-file links if the archive contract is rolled back.
INSERT INTO public.modelcatalog_configuration_input
  (configuration_id, input_id, is_optional)
VALUES
  ('https://w3id.org/okn/i/mint/modflow_2005_cfg', 'https://w3id.org/okn/i/mint/modflow_2005_Bas', FALSE),
  ('https://w3id.org/okn/i/mint/modflow_2005_cfg', 'https://w3id.org/okn/i/mint/modflow_2005_Bcf', FALSE),
  ('https://w3id.org/okn/i/mint/modflow_2005_cfg', 'https://w3id.org/okn/i/mint/modflow_2005_Dis', FALSE),
  ('https://w3id.org/okn/i/mint/modflow_2005_cfg', 'https://w3id.org/okn/i/mint/modflow_2005_Drn', FALSE),
  ('https://w3id.org/okn/i/mint/modflow_2005_cfg', 'https://w3id.org/okn/i/mint/modflow_2005_Hfb', FALSE),
  ('https://w3id.org/okn/i/mint/modflow_2005_cfg', 'https://w3id.org/okn/i/mint/modflow_2005_Oc', FALSE),
  ('https://w3id.org/okn/i/mint/modflow_2005_cfg', 'https://w3id.org/okn/i/mint/modflow_2005_Sip', FALSE)
ON CONFLICT DO NOTHING;

COMMIT;
