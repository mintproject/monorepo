-- Add same_as column to standard_variable for owl:sameAs URIs
ALTER TABLE modelcatalog_standard_variable
    ADD COLUMN same_as TEXT[];
