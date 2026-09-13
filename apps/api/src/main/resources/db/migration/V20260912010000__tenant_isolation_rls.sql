ALTER TABLE rti.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY programs_tenant_isolation
    ON rti.programs
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

ALTER TABLE rti.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY enrollments_tenant_isolation
    ON rti.enrollments
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
