BEGIN;

DELETE FROM public.modelcatalog_configuration_input
WHERE configuration_id =
  'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488'
  AND input_id = 'https://w3id.org/okn/i/mint/wmobley-modflow-6-simulation-archive';

INSERT INTO public.modelcatalog_configuration_input
  (configuration_id, input_id, is_optional)
VALUES (
  'https://w3id.org/okn/i/mint/ce445698-1d76-4833-95e8-a12eb3da2488',
  'https://w3id.org/okn/i/mint/89dc3d46-625b-4929-9732-c91bd0bdd28d',
  FALSE
)
ON CONFLICT DO NOTHING;

COMMIT;
