-- Keep options with their definition. No responses or existing prompts are rewritten.
ALTER TABLE rti.activity_evaluation_questions
    ADD COLUMN options TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE rti.activity_evaluation_questions DROP CONSTRAINT ck_activity_evaluation_questions_type;
ALTER TABLE rti.activity_evaluation_questions ADD CONSTRAINT ck_activity_evaluation_questions_type CHECK (
    question_type IN ('AGREEMENT_SCALE','LIKELIHOOD_SCALE','NUMERIC_SCALE','OPEN_TEXT',
                     'EMOTION_MULTI_SELECT','SINGLE_CHOICE_LETTERS','SINGLE_CHOICE_WORDS')
);

CREATE FUNCTION rti.valid_question_options(kind TEXT, choices TEXT[]) RETURNS BOOLEAN
LANGUAGE SQL IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
    SELECT CASE WHEN kind IN ('SINGLE_CHOICE_LETTERS','SINGLE_CHOICE_WORDS') THEN
        cardinality(choices) BETWEEN 2 AND 100
        AND array_ndims(choices) = 1 AND array_lower(choices,1) = 1
        AND NOT EXISTS (SELECT 1 FROM unnest(choices) v WHERE v IS NULL OR length(v) NOT BETWEEN 1 AND 200 OR btrim(v) <> v)
        AND cardinality(choices) = (SELECT count(DISTINCT lower(v)) FROM unnest(choices) v)
    ELSE cardinality(choices) = 0 END
$$;

ALTER TABLE rti.activity_evaluation_questions ADD CONSTRAINT ck_activity_evaluation_questions_options
    CHECK (rti.valid_question_options(question_type, options));
