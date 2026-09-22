BEGIN;

-- The archive contains the complete MODFLOW 2005 package bundle. The root
-- configuration should expose only the archive plus the semantic WEL/RCH
-- overrides, matching the MF6 contract shown by the problem-formulation UI.
DELETE FROM public.modelcatalog_configuration_input
WHERE configuration_id = 'https://w3id.org/okn/i/mint/modflow_2005_cfg'
  AND input_id IN (
    'https://w3id.org/okn/i/mint/modflow_2005_Bas',
    'https://w3id.org/okn/i/mint/modflow_2005_Bcf',
    'https://w3id.org/okn/i/mint/modflow_2005_Dis',
    'https://w3id.org/okn/i/mint/modflow_2005_Drn',
    'https://w3id.org/okn/i/mint/modflow_2005_Hfb',
    'https://w3id.org/okn/i/mint/modflow_2005_Oc',
    'https://w3id.org/okn/i/mint/modflow_2005_Sip'
  );

COMMIT;
