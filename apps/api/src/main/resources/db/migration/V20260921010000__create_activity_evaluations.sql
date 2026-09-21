CREATE TABLE rti.activity_evaluations (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    activity_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_activity_evaluations PRIMARY KEY (id),
    CONSTRAINT uq_activity_evaluations_organization_program_id
        UNIQUE (organization_id, program_id, id),
    CONSTRAINT uq_activity_evaluations_activity
        UNIQUE (organization_id, program_id, activity_id),
    CONSTRAINT ck_activity_evaluations_title CHECK (length(btrim(title)) BETWEEN 1 AND 255),
    CONSTRAINT ck_activity_evaluations_instructions CHECK (
        instructions IS NULL OR length(instructions) <= 2000
    ),
    CONSTRAINT fk_activity_evaluations_activity
        FOREIGN KEY (organization_id, program_id, activity_id)
        REFERENCES rti.program_activities (organization_id, program_id, id)
        ON DELETE RESTRICT
);

CREATE TABLE rti.activity_evaluation_questions (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    evaluation_id UUID NOT NULL,
    prompt VARCHAR(500) NOT NULL,
    question_type VARCHAR(32) NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_activity_evaluation_questions PRIMARY KEY (id),
    CONSTRAINT uq_activity_evaluation_questions_position
        UNIQUE (organization_id, evaluation_id, position),
    CONSTRAINT ck_activity_evaluation_questions_prompt CHECK (length(btrim(prompt)) BETWEEN 1 AND 500),
    CONSTRAINT ck_activity_evaluation_questions_type CHECK (
        question_type IN ('AGREEMENT_SCALE', 'LIKELIHOOD_SCALE', 'OPEN_TEXT', 'EMOTION_MULTI_SELECT')
    ),
    CONSTRAINT ck_activity_evaluation_questions_position CHECK (position > 0),
    CONSTRAINT fk_activity_evaluation_questions_evaluation
        FOREIGN KEY (organization_id, program_id, evaluation_id)
        REFERENCES rti.activity_evaluations (organization_id, program_id, id)
        ON DELETE CASCADE
);

ALTER TABLE rti.activity_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_evaluations_tenant_isolation
    ON rti.activity_evaluations TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

ALTER TABLE rti.activity_evaluation_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_evaluation_questions_tenant_isolation
    ON rti.activity_evaluation_questions TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE rti.activity_evaluations, rti.activity_evaluation_questions
    TO rti_app;
