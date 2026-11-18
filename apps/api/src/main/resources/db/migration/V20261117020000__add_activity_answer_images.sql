ALTER TABLE rti.activity_evaluation_questions
    DROP CONSTRAINT ck_activity_evaluation_questions_type,
    ADD CONSTRAINT ck_activity_evaluation_questions_type CHECK (
        question_type IN ('AGREEMENT_SCALE', 'LIKELIHOOD_SCALE', 'NUMERIC_SCALE', 'OPEN_TEXT',
                          'EMOTION_MULTI_SELECT', 'SINGLE_CHOICE_LETTERS', 'SINGLE_CHOICE_WORDS',
                          'MULTIPLE_CHOICE_WORDS', 'IMAGE')
    );

ALTER TABLE rti.activity_evaluation_answers
    DROP CONSTRAINT ck_activity_evaluation_answers_position,
    ADD CONSTRAINT ck_activity_evaluation_answers_position CHECK (position BETWEEN 1 AND 100);

CREATE TABLE rti.activity_answer_images (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    response_id UUID NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    image_bytes BYTEA NOT NULL CHECK (octet_length(image_bytes) BETWEEN 1 AND 10485760),
    FOREIGN KEY (organization_id, program_id, response_id)
        REFERENCES rti.activity_evaluation_responses (organization_id, program_id, id) ON DELETE CASCADE
);
CREATE INDEX ix_activity_answer_images_response
    ON rti.activity_answer_images (organization_id, program_id, response_id);

ALTER TABLE rti.activity_answer_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_answer_images_tenant ON rti.activity_answer_images TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);
GRANT SELECT, INSERT ON rti.activity_answer_images TO rti_app;
