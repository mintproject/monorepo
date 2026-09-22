BEGIN;

UPDATE public.modelcatalog_variable_presentation
SET has_standard_variable =
  'https://w3id.org/okn/i/mint/19ce71d1-61f4-4aa9-b747-e448a7d7619f'
WHERE id =
  'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head';

COMMIT;
