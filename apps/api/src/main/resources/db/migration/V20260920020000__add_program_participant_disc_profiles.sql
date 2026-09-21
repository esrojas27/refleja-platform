CREATE TABLE rti.program_participant_disc_profiles (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    dominant_text TEXT NOT NULL,
    influential_text TEXT NOT NULL,
    serene_text TEXT NOT NULL,
    conscientious_text TEXT NOT NULL,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_program_participant_disc_profiles PRIMARY KEY (id),
    CONSTRAINT uq_disc_profiles_program_enrollment UNIQUE (organization_id, program_id, enrollment_id),
    CONSTRAINT uq_disc_profiles_organization_program_enrollment_id
        UNIQUE (organization_id, program_id, enrollment_id, id),
    CONSTRAINT fk_disc_profiles_enrollment FOREIGN KEY (organization_id, program_id, enrollment_id)
        REFERENCES rti.enrollments (organization_id, program_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_disc_profiles_created_by FOREIGN KEY (created_by) REFERENCES rti.users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_disc_profiles_updated_by FOREIGN KEY (updated_by) REFERENCES rti.users (id) ON DELETE RESTRICT,
    CONSTRAINT ck_disc_profiles_dominant CHECK (length(btrim(dominant_text)) BETWEEN 1 AND 5000),
    CONSTRAINT ck_disc_profiles_influential CHECK (length(btrim(influential_text)) BETWEEN 1 AND 5000),
    CONSTRAINT ck_disc_profiles_serene CHECK (length(btrim(serene_text)) BETWEEN 1 AND 5000),
    CONSTRAINT ck_disc_profiles_conscientious CHECK (length(btrim(conscientious_text)) BETWEEN 1 AND 5000)
);

CREATE TABLE rti.program_participant_disc_profile_revisions (
    id UUID NOT NULL,
    profile_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    enrollment_id UUID NOT NULL,
    dominant_text TEXT NOT NULL,
    influential_text TEXT NOT NULL,
    serene_text TEXT NOT NULL,
    conscientious_text TEXT NOT NULL,
    action VARCHAR NOT NULL,
    actor_id UUID NOT NULL,
    profile_version BIGINT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT pk_program_participant_disc_profile_revisions PRIMARY KEY (id),
    CONSTRAINT uq_disc_profile_revision_version UNIQUE (profile_id, profile_version),
    CONSTRAINT fk_disc_profile_revisions_profile
        FOREIGN KEY (organization_id, program_id, enrollment_id, profile_id)
        REFERENCES rti.program_participant_disc_profiles
            (organization_id, program_id, enrollment_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_disc_profile_revisions_actor FOREIGN KEY (actor_id) REFERENCES rti.users (id) ON DELETE RESTRICT,
    CONSTRAINT ck_disc_profile_revisions_action CHECK (action IN ('CREATED', 'UPDATED')),
    CONSTRAINT ck_disc_profile_revisions_dominant CHECK (length(btrim(dominant_text)) BETWEEN 1 AND 5000),
    CONSTRAINT ck_disc_profile_revisions_influential CHECK (length(btrim(influential_text)) BETWEEN 1 AND 5000),
    CONSTRAINT ck_disc_profile_revisions_serene CHECK (length(btrim(serene_text)) BETWEEN 1 AND 5000),
    CONSTRAINT ck_disc_profile_revisions_conscientious CHECK (length(btrim(conscientious_text)) BETWEEN 1 AND 5000)
);

ALTER TABLE rti.program_participant_disc_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY program_participant_disc_profiles_tenant_isolation
    ON rti.program_participant_disc_profiles TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

ALTER TABLE rti.program_participant_disc_profile_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY program_participant_disc_profile_revisions_tenant_isolation
    ON rti.program_participant_disc_profile_revisions TO rti_app
    USING (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::UUID);

GRANT SELECT, INSERT, UPDATE ON TABLE rti.program_participant_disc_profiles TO rti_app;
GRANT SELECT, INSERT ON TABLE rti.program_participant_disc_profile_revisions TO rti_app;
