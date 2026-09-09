BEGIN;

DELETE FROM public.modelcatalog_dataset_specification_presentation
WHERE presentation_id = 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head';

DELETE FROM public.modelcatalog_variable_presentation
WHERE id = 'https://w3id.org/okn/i/mint/wmobley-modflow-2005-hydraulic-head';

COMMIT;
