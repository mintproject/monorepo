UPDATE public.modelcatalog_configuration
SET has_component_location = 'https://github.com/mintproject/MINT-WorkflowDomain/raw/master/WINGSWorkflowComponents/MODFLOW2005/MODFLOW2005.zip'
WHERE id IN (
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_advanced',
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_avg',
  'https://w3id.org/okn/i/mint/modflow_2005_BartonSprings_drought'
);
