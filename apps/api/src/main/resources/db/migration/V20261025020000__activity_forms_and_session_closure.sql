-- One definition/question catalog for activity deliverables and session closure surveys.
ALTER TABLE rti.activity_assignments DROP CONSTRAINT ck_activity_assignments_workflow;
ALTER TABLE rti.activity_assignments ADD CONSTRAINT ck_activity_assignments_workflow CHECK (
    (status='ASSIGNED' AND response_text IS NULL AND submitted_at IS NULL AND review_comment IS NULL AND reviewed_at IS NULL AND reviewed_by IS NULL) OR
    (status='SUBMITTED' AND submitted_at IS NOT NULL AND review_comment IS NULL AND reviewed_at IS NULL AND reviewed_by IS NULL) OR
    (status='CHANGES_REQUESTED' AND submitted_at IS NOT NULL AND review_comment IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL) OR
    (status='COMPLETED' AND submitted_at IS NOT NULL AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL));
ALTER TABLE rti.activity_evaluations ALTER COLUMN activity_id DROP NOT NULL;
ALTER TABLE rti.activity_evaluations ADD COLUMN session_id UUID;
ALTER TABLE rti.activity_evaluations ADD CONSTRAINT fk_evaluation_session
    FOREIGN KEY (organization_id,program_id,session_id) REFERENCES rti.program_sessions(organization_id,program_id,id) ON DELETE RESTRICT;
ALTER TABLE rti.activity_evaluations ADD CONSTRAINT ck_evaluation_scope CHECK ((activity_id IS NULL) <> (session_id IS NULL));
ALTER TABLE rti.activity_evaluations ADD CONSTRAINT uq_evaluation_session UNIQUE(organization_id,program_id,session_id);
ALTER TABLE rti.activity_evaluations ADD CONSTRAINT uq_evaluation_session_reference UNIQUE(organization_id,program_id,id,session_id);

ALTER TABLE rti.activity_evaluation_responses ALTER COLUMN activity_id DROP NOT NULL;
ALTER TABLE rti.activity_evaluation_responses ALTER COLUMN assignment_id DROP NOT NULL;
ALTER TABLE rti.activity_evaluation_responses ADD COLUMN session_id UUID;
ALTER TABLE rti.activity_evaluation_responses ADD CONSTRAINT ck_response_scope CHECK (
    (session_id IS NULL AND activity_id IS NOT NULL AND assignment_id IS NOT NULL) OR
    (session_id IS NOT NULL AND activity_id IS NULL AND assignment_id IS NULL));
ALTER TABLE rti.activity_evaluation_responses ADD CONSTRAINT fk_response_session_evaluation
    FOREIGN KEY(organization_id,program_id,evaluation_id,session_id)
    REFERENCES rti.activity_evaluations(organization_id,program_id,id,session_id) ON DELETE RESTRICT;
ALTER TABLE rti.activity_evaluation_responses ADD CONSTRAINT uq_response_session_enrollment UNIQUE(organization_id,program_id,session_id,enrollment_id);

CREATE TABLE rti.session_closure_acknowledgements (
    organization_id UUID NOT NULL, program_id UUID NOT NULL, session_id UUID NOT NULL, enrollment_id UUID NOT NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(organization_id,session_id,enrollment_id),
    FOREIGN KEY(organization_id,program_id,session_id) REFERENCES rti.program_sessions(organization_id,program_id,id) ON DELETE RESTRICT,
    FOREIGN KEY(organization_id,program_id,enrollment_id) REFERENCES rti.enrollments(organization_id,program_id,id) ON DELETE RESTRICT
);
CREATE TABLE rti.activity_form_response_revisions (
    id UUID PRIMARY KEY DEFAULT uuidv7(), organization_id UUID NOT NULL, program_id UUID NOT NULL,
    response_id UUID NOT NULL, response_version BIGINT NOT NULL, completed_at TIMESTAMPTZ NOT NULL,
    answers JSONB NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id,response_id,response_version),
    FOREIGN KEY(organization_id,program_id,response_id) REFERENCES rti.activity_evaluation_responses(organization_id,program_id,id) ON DELETE RESTRICT
);
ALTER TABLE rti.session_closure_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE rti.activity_form_response_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_closure_acknowledgements_tenant ON rti.session_closure_acknowledgements TO rti_app
    USING(organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID)
    WITH CHECK(organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID);
CREATE POLICY activity_form_response_revisions_tenant ON rti.activity_form_response_revisions TO rti_app
    USING(organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID)
    WITH CHECK(organization_id=NULLIF(current_setting('app.current_organization_id',true),'')::UUID);
GRANT SELECT,INSERT ON rti.session_closure_acknowledgements,rti.activity_form_response_revisions TO rti_app;
CREATE INDEX ix_closure_response_session ON rti.activity_evaluation_responses(organization_id,program_id,session_id) WHERE session_id IS NOT NULL;
