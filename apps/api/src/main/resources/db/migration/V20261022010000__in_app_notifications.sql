CREATE TABLE rti.activity_notifications (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    assignment_id UUID NOT NULL,
    recipient_membership_id UUID NOT NULL,
    kind VARCHAR NOT NULL CHECK (kind IN ('ACTIVITY_ASSIGNED','SUBMISSION_RECEIVED','CHANGES_REQUESTED','ACTIVITY_APPROVED','SURVEY_PENDING')),
    source_version BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ,
    CONSTRAINT uq_activity_notifications_event UNIQUE
        (organization_id, recipient_membership_id, assignment_id, kind, source_version),
    FOREIGN KEY (organization_id, program_id, assignment_id)
        REFERENCES rti.activity_assignments(organization_id, program_id, id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id, recipient_membership_id)
        REFERENCES rti.organization_memberships(organization_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_activity_notifications_inbox ON rti.activity_notifications
    (organization_id, recipient_membership_id, created_at DESC, id DESC);
ALTER TABLE rti.activity_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_notifications_tenant_isolation ON rti.activity_notifications TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id',true),'')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id',true),'')::UUID);
GRANT SELECT, INSERT, UPDATE, DELETE ON rti.activity_notifications TO rti_app;

-- Bring existing pending assignments into the inbox, without inventing old reviews.
INSERT INTO rti.activity_notifications
    (organization_id,program_id,assignment_id,recipient_membership_id,kind,source_version,created_at)
SELECT a.organization_id,a.program_id,a.id,e.participant_membership_id,'ACTIVITY_ASSIGNED',a.version,a.assigned_at
FROM rti.activity_assignments a JOIN rti.enrollments e ON e.organization_id=a.organization_id AND e.id=a.enrollment_id
WHERE a.status='ASSIGNED';
INSERT INTO rti.activity_notifications
    (organization_id,program_id,assignment_id,recipient_membership_id,kind,source_version,created_at)
SELECT a.organization_id,a.program_id,a.id,m.id,'SUBMISSION_RECEIVED',a.version,a.submitted_at
FROM rti.activity_assignments a
JOIN rti.organization_memberships m ON m.organization_id=a.organization_id AND m.status='ACTIVE'
JOIN rti.membership_roles r ON r.membership_id=m.id AND r.role='CONSULTANT'
WHERE a.status='SUBMITTED';
INSERT INTO rti.activity_notifications
    (organization_id,program_id,assignment_id,recipient_membership_id,kind,source_version,created_at)
SELECT a.organization_id,a.program_id,a.id,e.participant_membership_id,'SURVEY_PENDING',0,a.submitted_at
FROM rti.activity_assignments a JOIN rti.enrollments e ON e.organization_id=a.organization_id AND e.id=a.enrollment_id
WHERE a.submitted_at IS NOT NULL
AND EXISTS(SELECT FROM rti.activity_evaluations v WHERE v.organization_id=a.organization_id AND v.activity_id=a.activity_id)
AND NOT EXISTS(SELECT FROM rti.activity_evaluation_responses v WHERE v.organization_id=a.organization_id AND v.assignment_id=a.id);
