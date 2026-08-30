-- Add type column to store the RDF type URI (e.g., sdm#Model, sdm#EmpiricalModel)
ALTER TABLE modelcatalog_software ADD COLUMN type TEXT;

-- Backfill: default all existing rows to sdm#Model (the base type)
-- The ETL re-run will set the correct specific types
UPDATE modelcatalog_software SET type = 'https://w3id.org/okn/o/sdm#Model' WHERE type IS NULL;
