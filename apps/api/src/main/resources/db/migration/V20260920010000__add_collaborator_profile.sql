ALTER TABLE rti.users
    ADD COLUMN full_name VARCHAR,
    ADD COLUMN date_of_birth DATE,
    ADD COLUMN phone VARCHAR,
    ADD COLUMN city VARCHAR,
    ADD COLUMN country VARCHAR;

ALTER TABLE rti.organization_memberships
    ADD COLUMN job_title VARCHAR,
    ADD COLUMN profile_status VARCHAR NOT NULL DEFAULT 'PENDING',
    ADD CONSTRAINT ck_organization_memberships_profile_status
        CHECK (profile_status IN ('PENDING', 'COMPLETE'));
