ALTER TABLE rti.program_sessions
    ADD CONSTRAINT uq_program_sessions_organization_program_module_id
        UNIQUE (organization_id, program_id, module_id, id);

ALTER TABLE rti.enrollments
    ADD CONSTRAINT uq_enrollments_organization_program_id
        UNIQUE (organization_id, program_id, id);

CREATE TABLE rti.program_activities (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    module_id UUID NOT NULL,
    session_id UUID NOT NULL,
    title VARCHAR NOT NULL,
    instructions TEXT NOT NULL,
    due_date DATE NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_program_activities PRIMARY KEY (id),
    CONSTRAINT uq_program_activities_organization_program_id
        UNIQUE (organization_id, program_id, id),
    CONSTRAINT uq_program_activities_position
        UNIQUE (organization_id, session_id, position),
    CONSTRAINT ck_program_activities_position CHECK (position > 0),
    CONSTRAINT fk_program_activities_session
        FOREIGN KEY (organization_id, program_id, module_id, session_id)
        REFERENCES rti.program_sessions (organization_id, program_id, module_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE rti.activity_assignments (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    activity_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_activity_assignments PRIMARY KEY (id),
    CONSTRAINT uq_activity_assignments_activity_enrollment
        UNIQUE (organization_id, activity_id, enrollment_id),
    CONSTRAINT fk_activity_assignments_activity
        FOREIGN KEY (organization_id, program_id, activity_id)
        REFERENCES rti.program_activities (organization_id, program_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_activity_assignments_enrollment
        FOREIGN KEY (organization_id, program_id, enrollment_id)
        REFERENCES rti.enrollments (organization_id, program_id, id)
        ON DELETE RESTRICT
);

ALTER TABLE rti.program_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY program_activities_tenant_isolation
    ON rti.program_activities
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

ALTER TABLE rti.activity_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY activity_assignments_tenant_isolation
    ON rti.activity_assignments
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
        rti.program_activities,
        rti.activity_assignments
    TO rti_app;
