CREATE TABLE rti.program_modules (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_program_modules PRIMARY KEY (id),
    CONSTRAINT uq_program_modules_organization_program_id
        UNIQUE (organization_id, program_id, id),
    CONSTRAINT uq_program_modules_position
        UNIQUE (organization_id, program_id, position),
    CONSTRAINT ck_program_modules_position CHECK (position > 0),
    CONSTRAINT fk_program_modules_program
        FOREIGN KEY (organization_id, program_id)
        REFERENCES rti.programs (organization_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE rti.program_sessions (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    module_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    scheduled_date DATE NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_program_sessions PRIMARY KEY (id),
    CONSTRAINT uq_program_sessions_organization_id
        UNIQUE (organization_id, id),
    CONSTRAINT uq_program_sessions_position
        UNIQUE (organization_id, module_id, position),
    CONSTRAINT ck_program_sessions_position CHECK (position > 0),
    CONSTRAINT fk_program_sessions_module
        FOREIGN KEY (organization_id, program_id, module_id)
        REFERENCES rti.program_modules (organization_id, program_id, id)
        ON DELETE RESTRICT
);

ALTER TABLE rti.program_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY program_modules_tenant_isolation
    ON rti.program_modules
    TO rti_app
    USING (
        organization_id = NULLIF(
            current_setting('app.current_organization_id', true),
            ''
        )::UUID
    )
    WITH CHECK (
        organization_id = NULLIF(
            current_setting('app.current_organization_id', true),
            ''
        )::UUID
    );

ALTER TABLE rti.program_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY program_sessions_tenant_isolation
    ON rti.program_sessions
    TO rti_app
    USING (
        organization_id = NULLIF(
            current_setting('app.current_organization_id', true),
            ''
        )::UUID
    )
    WITH CHECK (
        organization_id = NULLIF(
            current_setting('app.current_organization_id', true),
            ''
        )::UUID
    );

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE
        rti.program_modules,
        rti.program_sessions
    TO rti_app;
