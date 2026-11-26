-- Keep qualitative columns and old revisions intact; do not invent numeric equivalents.
ALTER TABLE rti.program_participant_disc_profiles
    ADD COLUMN dominant_percent INTEGER,
    ADD COLUMN influential_percent INTEGER,
    ADD COLUMN serene_percent INTEGER,
    ADD COLUMN conscientious_percent INTEGER,
    ALTER COLUMN dominant_text DROP NOT NULL,
    ALTER COLUMN influential_text DROP NOT NULL,
    ALTER COLUMN serene_text DROP NOT NULL,
    ALTER COLUMN conscientious_text DROP NOT NULL;
ALTER TABLE rti.program_participant_disc_profile_revisions
    ADD COLUMN dominant_percent INTEGER,
    ADD COLUMN influential_percent INTEGER,
    ADD COLUMN serene_percent INTEGER,
    ADD COLUMN conscientious_percent INTEGER,
    ALTER COLUMN dominant_text DROP NOT NULL,
    ALTER COLUMN influential_text DROP NOT NULL,
    ALTER COLUMN serene_text DROP NOT NULL,
    ALTER COLUMN conscientious_text DROP NOT NULL;
ALTER TABLE rti.program_participant_disc_profiles ADD CONSTRAINT ck_disc_percentages CHECK (
    (dominant_percent IS NULL AND influential_percent IS NULL AND serene_percent IS NULL AND conscientious_percent IS NULL
     AND dominant_text IS NOT NULL AND influential_text IS NOT NULL AND serene_text IS NOT NULL AND conscientious_text IS NOT NULL)
    OR
    (dominant_percent IS NOT NULL AND dominant_percent BETWEEN 0 AND 100
     AND influential_percent IS NOT NULL AND influential_percent BETWEEN 0 AND 100
     AND serene_percent IS NOT NULL AND serene_percent BETWEEN 0 AND 100
     AND conscientious_percent IS NOT NULL AND conscientious_percent BETWEEN 0 AND 100)
);
ALTER TABLE rti.program_participant_disc_profile_revisions ADD CONSTRAINT ck_disc_revision_percentages CHECK (
    (dominant_percent IS NULL AND influential_percent IS NULL AND serene_percent IS NULL AND conscientious_percent IS NULL
     AND dominant_text IS NOT NULL AND influential_text IS NOT NULL AND serene_text IS NOT NULL AND conscientious_text IS NOT NULL)
    OR
    (dominant_percent IS NOT NULL AND dominant_percent BETWEEN 0 AND 100
     AND influential_percent IS NOT NULL AND influential_percent BETWEEN 0 AND 100
     AND serene_percent IS NOT NULL AND serene_percent BETWEEN 0 AND 100
     AND conscientious_percent IS NOT NULL AND conscientious_percent BETWEEN 0 AND 100)
);

-- The sequence belongs to the participant/program and survives deletion of a PDF.
ALTER TABLE rti.enrollments ADD COLUMN disc_pdf_version INTEGER NOT NULL DEFAULT 0 CHECK (disc_pdf_version >= 0);
ALTER TABLE rti.participant_files ADD COLUMN document_type TEXT, ADD COLUMN document_version INTEGER;
ALTER TABLE rti.participant_files ADD CONSTRAINT ck_participant_file_document CHECK (
    (document_type IS NULL AND document_version IS NULL)
    OR
    (document_type IS NOT NULL AND document_type = 'DISC' AND document_version IS NOT NULL AND document_version > 0
     AND title = 'DISC' AND content_type = 'application/pdf')
);
CREATE UNIQUE INDEX uq_participant_disc_pdf_version ON rti.participant_files(organization_id,program_id,enrollment_id,document_type,document_version)
    WHERE document_type IS NOT NULL;
