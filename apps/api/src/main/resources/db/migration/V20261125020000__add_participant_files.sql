CREATE TABLE rti.participant_files (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 10),
    title VARCHAR(160) NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
    content_type TEXT NOT NULL CHECK (content_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
    file_bytes BYTEA NOT NULL CHECK (octet_length(file_bytes) BETWEEN 1 AND 10485760),
    size_bytes INTEGER GENERATED ALWAYS AS (octet_length(file_bytes)) STORED,
    created_by UUID NOT NULL REFERENCES rti.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id,program_id,enrollment_id,slot),
    FOREIGN KEY (organization_id,program_id,enrollment_id)
        REFERENCES rti.enrollments(organization_id,program_id,id) ON DELETE RESTRICT
);
ALTER TABLE rti.participant_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY participant_files_tenant ON rti.participant_files TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id',true),'')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id',true),'')::UUID);
GRANT SELECT, INSERT, DELETE ON rti.participant_files TO rti_app;
