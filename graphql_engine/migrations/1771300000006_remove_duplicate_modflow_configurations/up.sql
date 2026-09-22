BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.execution
    WHERE modelcatalog_configuration_id IN (
      'https://w3id.org/okn/i/mint/a57dafde-d855-4ed8-9eca-f8f50fa95635',
      'https://w3id.org/okn/i/mint/b8fa91f0-c000-4d5c-ade9-fa6eb8f0147b',
      'https://w3id.org/okn/i/mint/1a0d307c-539b-45b2-aff6-a97fb22a0739',
      'https://w3id.org/okn/i/mint/dcd878ae-5e7d-44c4-805b-7bd3f3fc1637'
    )
  ) OR EXISTS (
    SELECT 1
    FROM public.thread_model
    WHERE modelcatalog_configuration_id IN (
      'https://w3id.org/okn/i/mint/a57dafde-d855-4ed8-9eca-f8f50fa95635',
      'https://w3id.org/okn/i/mint/b8fa91f0-c000-4d5c-ade9-fa6eb8f0147b',
      'https://w3id.org/okn/i/mint/1a0d307c-539b-45b2-aff6-a97fb22a0739',
      'https://w3id.org/okn/i/mint/dcd878ae-5e7d-44c4-805b-7bd3f3fc1637'
    )
  ) THEN
    RAISE EXCEPTION 'Cannot remove duplicate MODFLOW configurations because an execution or thread references one';
  END IF;
END $$;

-- The GAM Capitan Reef configuration used the expanded MODFLOW 2005 row as
-- its parent. Preserve that relationship through the canonical row before
-- deleting the duplicate parent.
UPDATE public.modelcatalog_configuration
SET model_configuration_id = 'https://w3id.org/okn/i/mint/modflow_2005_cfg'
WHERE model_configuration_id =
  'https://w3id.org/okn/i/mint/a57dafde-d855-4ed8-9eca-f8f50fa95635';

DELETE FROM public.modelcatalog_configuration
WHERE id IN (
  'https://w3id.org/okn/i/mint/a57dafde-d855-4ed8-9eca-f8f50fa95635',
  'https://w3id.org/okn/i/mint/b8fa91f0-c000-4d5c-ade9-fa6eb8f0147b',
  'https://w3id.org/okn/i/mint/1a0d307c-539b-45b2-aff6-a97fb22a0739',
  'https://w3id.org/okn/i/mint/dcd878ae-5e7d-44c4-805b-7bd3f3fc1637'
);

COMMIT;
