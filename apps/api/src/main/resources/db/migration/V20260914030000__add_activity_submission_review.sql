ALTER TABLE rti.activity_assignments
    ADD COLUMN status VARCHAR NOT NULL DEFAULT 'ASSIGNED',
    ADD COLUMN response_text TEXT,
    ADD COLUMN submitted_at TIMESTAMPTZ,
    ADD COLUMN review_comment TEXT,
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD COLUMN reviewed_by UUID,
    ADD CONSTRAINT ck_activity_assignments_status CHECK (
        status IN ('ASSIGNED', 'SUBMITTED', 'CHANGES_REQUESTED', 'COMPLETED')
    ),
    ADD CONSTRAINT ck_activity_assignments_response_length CHECK (
        response_text IS NULL OR char_length(response_text) <= 10000
    ),
    ADD CONSTRAINT ck_activity_assignments_review_comment_length CHECK (
        review_comment IS NULL OR char_length(review_comment) <= 5000
    ),
    ADD CONSTRAINT ck_activity_assignments_workflow CHECK (
        (status = 'ASSIGNED'
            AND response_text IS NULL
            AND submitted_at IS NULL
            AND review_comment IS NULL
            AND reviewed_at IS NULL
            AND reviewed_by IS NULL)
        OR
        (status = 'SUBMITTED'
            AND response_text IS NOT NULL
            AND submitted_at IS NOT NULL
            AND review_comment IS NULL
            AND reviewed_at IS NULL
            AND reviewed_by IS NULL)
        OR
        (status = 'CHANGES_REQUESTED'
            AND response_text IS NOT NULL
            AND submitted_at IS NOT NULL
            AND review_comment IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND reviewed_by IS NOT NULL)
        OR
        (status = 'COMPLETED'
            AND response_text IS NOT NULL
            AND submitted_at IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND reviewed_by IS NOT NULL)
    ),
    ADD CONSTRAINT fk_activity_assignments_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES rti.users (id)
        ON DELETE RESTRICT;

ALTER TABLE rti.activity_assignments
    ALTER COLUMN status DROP DEFAULT;
