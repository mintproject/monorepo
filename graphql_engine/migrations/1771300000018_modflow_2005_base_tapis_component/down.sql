BEGIN;

UPDATE public.modelcatalog_configuration
SET has_component_location = 'https://github.com/mintproject/MINT-WorkflowDomain/raw/master/WINGSWorkflowComponents/MODFLOW2005/MODFLOW2005.zip'
WHERE id = 'https://w3id.org/okn/i/mint/modflow_2005_cfg'
  AND has_component_location = 'https://tapis.tapis.io/v3/apps/modflow-2005/0.0.6';

COMMIT;
