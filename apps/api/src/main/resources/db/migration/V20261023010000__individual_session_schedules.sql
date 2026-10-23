-- One model for all programs. Preserve the old dates as individual schedules and
-- deadline snapshots before allowing date-free content definitions.
ALTER TABLE rti.program_sessions ADD CONSTRAINT uq_session_schedule_parent UNIQUE (organization_id,program_id,id);
ALTER TABLE rti.program_sessions ALTER COLUMN scheduled_date DROP NOT NULL;
ALTER TABLE rti.program_activities ALTER COLUMN due_date DROP NOT NULL;
ALTER TABLE rti.activity_assignments ADD COLUMN due_date DATE;
UPDATE rti.activity_assignments a SET due_date=d.due_date
FROM rti.program_activities d WHERE d.organization_id=a.organization_id AND d.id=a.activity_id;

CREATE TABLE rti.session_schedules (
    organization_id UUID NOT NULL, program_id UUID NOT NULL, session_id UUID NOT NULL, enrollment_id UUID NOT NULL,
    scheduled_date DATE NOT NULL, version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (organization_id,session_id,enrollment_id),
    FOREIGN KEY (organization_id,program_id,session_id) REFERENCES rti.program_sessions(organization_id,program_id,id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id,program_id,enrollment_id) REFERENCES rti.enrollments(organization_id,program_id,id) ON DELETE RESTRICT
);
CREATE TABLE rti.session_schedule_history (
    id UUID PRIMARY KEY DEFAULT uuidv7(), organization_id UUID NOT NULL, program_id UUID NOT NULL,
    session_id UUID NOT NULL, enrollment_id UUID NOT NULL, previous_date DATE, scheduled_date DATE NOT NULL,
    version BIGINT NOT NULL, actor_id UUID REFERENCES rti.users(id) ON DELETE RESTRICT,
    actor_label VARCHAR NOT NULL, reason VARCHAR NOT NULL, source VARCHAR NOT NULL CHECK(source IN ('MIGRATED','ASSIGNED','RESCHEDULED')),
    request_id VARCHAR, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id,session_id,enrollment_id,version),
    UNIQUE (organization_id,id),
    FOREIGN KEY (organization_id,session_id,enrollment_id) REFERENCES rti.session_schedules(organization_id,session_id,enrollment_id) ON DELETE RESTRICT
);
CREATE TABLE rti.session_schedule_notifications (
    id UUID PRIMARY KEY DEFAULT uuidv7(), organization_id UUID NOT NULL, revision_id UUID NOT NULL,
    recipient_membership_id UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), read_at TIMESTAMPTZ,
    UNIQUE (organization_id,revision_id,recipient_membership_id),
    FOREIGN KEY (organization_id,revision_id) REFERENCES rti.session_schedule_history(organization_id,id) ON DELETE RESTRICT,
    FOREIGN KEY (organization_id,recipient_membership_id) REFERENCES rti.organization_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX ix_session_schedule_history ON rti.session_schedule_history(organization_id,session_id,enrollment_id,recorded_at DESC,id DESC);
CREATE INDEX ix_session_schedule_notifications ON rti.session_schedule_notifications(organization_id,recipient_membership_id,created_at DESC,id DESC);

INSERT INTO rti.session_schedules(organization_id,program_id,session_id,enrollment_id,scheduled_date)
SELECT s.organization_id,s.program_id,s.id,e.id,s.scheduled_date
FROM rti.program_sessions s JOIN rti.enrollments e ON e.organization_id=s.organization_id AND e.program_id=s.program_id
WHERE s.scheduled_date IS NOT NULL;
INSERT INTO rti.session_schedule_history(organization_id,program_id,session_id,enrollment_id,scheduled_date,version,actor_label,reason,source)
SELECT organization_id,program_id,session_id,enrollment_id,scheduled_date,0,'Migración de datos',
    'Se conserva la fecha anterior de la sesión y los vencimientos existentes.','MIGRATED' FROM rti.session_schedules;
-- Historical definition dates are retained as data, but are no longer used as
-- fallback scheduling, in templates, or for deadlines of new assignments.
ALTER TABLE rti.session_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rti.session_schedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rti.session_schedule_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_schedules_tenant ON rti.session_schedules TO rti_app
    USING(organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID)
    WITH CHECK(organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID);
CREATE POLICY session_schedule_history_tenant ON rti.session_schedule_history TO rti_app
    USING(organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID)
    WITH CHECK(organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID);
CREATE POLICY session_schedule_notifications_tenant ON rti.session_schedule_notifications TO rti_app
    USING(organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID)
    WITH CHECK(organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID);
GRANT SELECT,INSERT,UPDATE ON rti.session_schedules,rti.session_schedule_notifications TO rti_app;
GRANT SELECT,INSERT ON rti.session_schedule_history TO rti_app;
