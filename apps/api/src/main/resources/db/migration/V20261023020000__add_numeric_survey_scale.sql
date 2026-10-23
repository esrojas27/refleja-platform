-- Extend the allowed types without changing existing questions or responses.
ALTER TABLE rti.activity_evaluation_questions
    DROP CONSTRAINT ck_activity_evaluation_questions_type;

ALTER TABLE rti.activity_evaluation_questions
    ADD CONSTRAINT ck_activity_evaluation_questions_type CHECK (
        question_type IN ('AGREEMENT_SCALE', 'LIKELIHOOD_SCALE', 'NUMERIC_SCALE', 'OPEN_TEXT', 'EMOTION_MULTI_SELECT')
    );
