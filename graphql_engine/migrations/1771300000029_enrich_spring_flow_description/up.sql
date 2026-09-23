-- Add natural-language context so semantic recommendations can identify
-- spring flow as a groundwater-model outcome.

BEGIN;

UPDATE public.modelcatalog_standard_variable
SET description =
  'Modeled spring discharge or spring flow rate from a groundwater model. '
  'Represents the volume of groundwater emerging from a spring and is used '
  'to evaluate future groundwater conditions, pumping scenarios, drought '
  'impacts, and desired future conditions.'
WHERE id = 'https://w3id.org/okn/i/mint/spring__volume_flow_rate';

COMMIT;
