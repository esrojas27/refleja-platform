CREATE TABLE rti.program_templates (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    source_program_id UUID NOT NULL,
    created_by_user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    snapshot TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_program_templates PRIMARY KEY (id),
    CONSTRAINT uq_program_templates_organization_id UNIQUE (organization_id, id),
    CONSTRAINT fk_program_templates_source_program
        FOREIGN KEY (organization_id, source_program_id)
        REFERENCES rti.programs (organization_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_program_templates_created_by
        FOREIGN KEY (created_by_user_id) REFERENCES rti.users (id) ON DELETE RESTRICT,
    CONSTRAINT ck_program_templates_name CHECK (length(btrim(name)) BETWEEN 1 AND 255),
    CONSTRAINT ck_program_templates_description CHECK (description IS NULL OR length(description) <= 10000),
    CONSTRAINT ck_program_templates_snapshot CHECK (length(snapshot) > 0)
);

CREATE UNIQUE INDEX uq_program_templates_organization_name
    ON rti.program_templates (organization_id, lower(name));

ALTER TABLE rti.program_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY program_templates_tenant_isolation
    ON rti.program_templates TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

GRANT SELECT, INSERT ON TABLE rti.program_templates TO rti_app;
