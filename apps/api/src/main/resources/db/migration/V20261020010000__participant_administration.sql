ALTER TABLE rti.enrollments DROP CONSTRAINT ck_enrollments_status;
ALTER TABLE rti.enrollments ADD CONSTRAINT ck_enrollments_status CHECK (
    status IN ('PENDING_APPROVAL','INVITED','ACTIVE','COMPLETED','WITHDRAWN','SUSPENDED'));
ALTER TABLE rti.enrollments ADD COLUMN suspended_from_status VARCHAR;
ALTER TABLE rti.enrollments ADD CONSTRAINT ck_enrollments_suspended_from CHECK (
    (status = 'SUSPENDED' AND suspended_from_status IS NOT NULL AND suspended_from_status IN ('ACTIVE','COMPLETED'))
    OR (status <> 'SUSPENDED' AND suspended_from_status IS NULL));

CREATE TABLE rti.enrollment_changes (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    membership_id UUID NOT NULL,
    action VARCHAR NOT NULL,
    previous_status VARCHAR,
    status VARCHAR NOT NULL,
    previous_roles VARCHAR NOT NULL,
    roles VARCHAR NOT NULL,
    previous_invitation_id UUID,
    invitation_id UUID,
    actor_id UUID NOT NULL,
    actor_label VARCHAR(255) NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    request_id UUID NOT NULL,
    enrollment_version BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT fk_enrollment_changes_enrollment FOREIGN KEY (organization_id,program_id,enrollment_id)
        REFERENCES rti.enrollments (organization_id,program_id,id) ON DELETE RESTRICT,
    CONSTRAINT fk_enrollment_changes_actor FOREIGN KEY (actor_id) REFERENCES rti.users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_enrollment_changes_membership FOREIGN KEY (organization_id,membership_id)
        REFERENCES rti.organization_memberships(organization_id,id) ON DELETE RESTRICT,
    CONSTRAINT fk_enrollment_changes_previous_invitation FOREIGN KEY (organization_id,previous_invitation_id,membership_id)
        REFERENCES rti.user_invitations(organization_id,id,membership_id) ON DELETE RESTRICT,
    CONSTRAINT fk_enrollment_changes_invitation FOREIGN KEY (organization_id,invitation_id,membership_id)
        REFERENCES rti.user_invitations(organization_id,id,membership_id) ON DELETE RESTRICT,
    CONSTRAINT ck_enrollment_changes_action CHECK (action IN ('INVITED','ACCEPTED','REVOKE','WITHDRAW','SUSPEND','COMPLETE','REINSTATE','CHANGE_ROLE')),
    CONSTRAINT ck_enrollment_changes_reason CHECK (length(btrim(reason)) BETWEEN 1 AND 1000)
);
CREATE INDEX ix_enrollment_changes_history ON rti.enrollment_changes (organization_id,program_id,enrollment_id,recorded_at DESC,id DESC);
CREATE INDEX ix_enrollment_changes_membership ON rti.enrollment_changes (organization_id,membership_id,recorded_at DESC,id DESC);
CREATE INDEX ix_enrollment_changes_invitation ON rti.enrollment_changes (organization_id,invitation_id);
CREATE INDEX ix_enrollment_changes_previous_invitation ON rti.enrollment_changes (organization_id,previous_invitation_id);
ALTER TABLE rti.enrollment_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY enrollment_changes_tenant_isolation ON rti.enrollment_changes TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id',true),'')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id',true),'')::UUID);
GRANT SELECT, INSERT ON TABLE rti.enrollment_changes TO rti_app;
