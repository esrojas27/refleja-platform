ALTER TABLE rti.program_modules ADD COLUMN archived boolean NOT NULL DEFAULT false;
ALTER TABLE rti.program_sessions ADD COLUMN archived boolean NOT NULL DEFAULT false;
ALTER TABLE rti.program_activities ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Reordering swaps existing positive positions atomically. Only those transactions
-- defer the uniqueness checks; ordinary creation still checks them immediately.
ALTER TABLE rti.program_modules DROP CONSTRAINT uq_program_modules_position;
ALTER TABLE rti.program_modules ADD CONSTRAINT uq_program_modules_position
    UNIQUE (organization_id, program_id, position) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE rti.program_sessions DROP CONSTRAINT uq_program_sessions_position;
ALTER TABLE rti.program_sessions ADD CONSTRAINT uq_program_sessions_position
    UNIQUE (organization_id, module_id, position) DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE rti.program_activities DROP CONSTRAINT uq_program_activities_position;
ALTER TABLE rti.program_activities ADD CONSTRAINT uq_program_activities_position
    UNIQUE (organization_id, session_id, position) DEFERRABLE INITIALLY IMMEDIATE;
