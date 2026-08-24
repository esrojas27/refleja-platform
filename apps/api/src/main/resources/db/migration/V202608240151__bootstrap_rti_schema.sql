-- Flyway creates the configured rti schema before running this migration.
-- This infrastructure-only migration proves versioned schema management without
-- introducing tables or other objects belonging to future domain tickets.
COMMENT ON SCHEMA rti IS 'Application schema managed by Flyway.';
