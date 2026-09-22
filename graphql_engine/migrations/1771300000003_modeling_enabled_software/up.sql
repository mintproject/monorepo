BEGIN;

ALTER TABLE public.modelcatalog_software
  ADD COLUMN is_modeling_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- These catalog entries are reference/legacy coupled workflows, not one of
-- the four runnable MODFLOW families exposed by the modeling wizard.
UPDATE public.modelcatalog_software
SET is_modeling_enabled = FALSE
WHERE id IN (
  'https://w3id.org/okn/i/mint/ac0a108b-eca1-4f20-af3e-d6d87f29e03f',
  'https://w3id.org/okn/i/mint/5178a907-4464-45b4-bc12-404e7c7eeab2'
);

COMMIT;
