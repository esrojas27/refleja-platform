ALTER TABLE rti.activity_assignments
    ADD CONSTRAINT uq_activity_assignments_organization_program_id
        UNIQUE (organization_id, program_id, id);

ALTER TABLE rti.activity_evaluation_questions
    ADD CONSTRAINT uq_activity_evaluation_questions_organization_program_id
        UNIQUE (organization_id, program_id, id);

CREATE TABLE rti.activity_evaluation_responses (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    activity_id UUID NOT NULL,
    evaluation_id UUID NOT NULL,
    assignment_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_activity_evaluation_responses PRIMARY KEY (id),
    CONSTRAINT uq_activity_evaluation_responses_organization_program_id
        UNIQUE (organization_id, program_id, id),
    CONSTRAINT uq_activity_evaluation_responses_assignment
        UNIQUE (organization_id, program_id, assignment_id),
    CONSTRAINT fk_activity_evaluation_responses_evaluation
        FOREIGN KEY (organization_id, program_id, evaluation_id)
        REFERENCES rti.activity_evaluations (organization_id, program_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_activity_evaluation_responses_assignment
        FOREIGN KEY (organization_id, program_id, assignment_id)
        REFERENCES rti.activity_assignments (organization_id, program_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_activity_evaluation_responses_enrollment
        FOREIGN KEY (organization_id, program_id, enrollment_id)
        REFERENCES rti.enrollments (organization_id, program_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE rti.activity_evaluation_answers (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    response_id UUID NOT NULL,
    question_id UUID NOT NULL,
    answer_value VARCHAR(5000) NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_activity_evaluation_answers PRIMARY KEY (id),
    CONSTRAINT uq_activity_evaluation_answers_position
        UNIQUE (organization_id, response_id, question_id, position),
    CONSTRAINT ck_activity_evaluation_answers_value CHECK (length(btrim(answer_value)) BETWEEN 1 AND 5000),
    CONSTRAINT ck_activity_evaluation_answers_position CHECK (position BETWEEN 1 AND 2),
    CONSTRAINT fk_activity_evaluation_answers_response
        FOREIGN KEY (organization_id, program_id, response_id)
        REFERENCES rti.activity_evaluation_responses (organization_id, program_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_activity_evaluation_answers_question
        FOREIGN KEY (organization_id, program_id, question_id)
        REFERENCES rti.activity_evaluation_questions (organization_id, program_id, id)
        ON DELETE RESTRICT
);

ALTER TABLE rti.activity_evaluation_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_evaluation_responses_tenant_isolation
    ON rti.activity_evaluation_responses TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

ALTER TABLE rti.activity_evaluation_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_evaluation_answers_tenant_isolation
    ON rti.activity_evaluation_answers TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE rti.activity_evaluation_responses, rti.activity_evaluation_answers
    TO rti_app;
