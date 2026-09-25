BEGIN;

UPDATE public.modelcatalog_standard_variable
SET description = 'Volume flow rate from a modeled spring.'
WHERE id = 'https://w3id.org/okn/i/mint/spring__volume_flow_rate';

COMMIT;
