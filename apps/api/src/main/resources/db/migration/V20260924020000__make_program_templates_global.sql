DROP POLICY IF EXISTS program_templates_tenant_isolation ON rti.program_templates;

DROP INDEX IF EXISTS rti.uq_program_templates_organization_name;
ALTER TABLE rti.program_templates
    DROP CONSTRAINT uq_program_templates_organization_id,
    DROP CONSTRAINT fk_program_templates_source_program;

ALTER TABLE rti.program_templates
    RENAME COLUMN organization_id TO source_organization_id;

ALTER TABLE rti.program_templates
    ADD CONSTRAINT fk_program_templates_source_program
        FOREIGN KEY (source_organization_id, source_program_id)
        REFERENCES rti.programs (organization_id, id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX uq_program_templates_name
    ON rti.program_templates (lower(name));

CREATE POLICY program_templates_global_read
    ON rti.program_templates FOR SELECT TO rti_app
    USING (true);

CREATE POLICY program_templates_source_insert
    ON rti.program_templates FOR INSERT TO rti_app
    WITH CHECK (
        source_organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID
    );
