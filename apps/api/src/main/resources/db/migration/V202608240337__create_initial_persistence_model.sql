CREATE TABLE rti.users (
    id UUID NOT NULL,
    cognito_subject VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    email_normalized VARCHAR NOT NULL,
    first_name VARCHAR,
    last_name VARCHAR,
    status VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_cognito_subject UNIQUE (cognito_subject),
    CONSTRAINT ck_users_status CHECK (
        status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED')
    )
);

CREATE TABLE rti.organizations (
    id UUID NOT NULL,
    name VARCHAR NOT NULL,
    slug VARCHAR,
    status VARCHAR NOT NULL,
    logo_s3_key VARCHAR,
    default_time_zone VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_organizations PRIMARY KEY (id),
    CONSTRAINT ck_organizations_status CHECK (
        status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')
    )
);

CREATE TABLE rti.organization_memberships (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR NOT NULL,
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_organization_memberships PRIMARY KEY (id),
    CONSTRAINT uq_organization_memberships_organization_user
        UNIQUE (organization_id, user_id),
    CONSTRAINT uq_organization_memberships_organization_id
        UNIQUE (organization_id, id),
    CONSTRAINT ck_organization_memberships_status CHECK (
        status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')
    ),
    CONSTRAINT fk_organization_memberships_organization
        FOREIGN KEY (organization_id)
        REFERENCES rti.organizations (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_organization_memberships_user
        FOREIGN KEY (user_id)
        REFERENCES rti.users (id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_organization_memberships_user
    ON rti.organization_memberships (user_id);

CREATE TABLE rti.membership_roles (
    membership_id UUID NOT NULL,
    role VARCHAR NOT NULL,
    CONSTRAINT pk_membership_roles PRIMARY KEY (membership_id, role),
    CONSTRAINT ck_membership_roles_role CHECK (
        role IN (
            'SUPER_ADMIN',
            'CONSULTANT',
            'COMPANY_ADMIN',
            'LEADER',
            'COLLABORATOR'
        )
    ),
    CONSTRAINT fk_membership_roles_membership
        FOREIGN KEY (membership_id)
        REFERENCES rti.organization_memberships (id)
        ON DELETE RESTRICT
);

CREATE TABLE rti.programs (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR NOT NULL,
    start_date DATE,
    end_date DATE,
    primary_consultant_membership_id UUID,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_programs PRIMARY KEY (id),
    CONSTRAINT uq_programs_organization_id UNIQUE (organization_id, id),
    CONSTRAINT ck_programs_status CHECK (
        status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')
    ),
    CONSTRAINT fk_programs_organization
        FOREIGN KEY (organization_id)
        REFERENCES rti.organizations (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_programs_primary_consultant_membership
        FOREIGN KEY (organization_id, primary_consultant_membership_id)
        REFERENCES rti.organization_memberships (organization_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_programs_primary_consultant_membership
    ON rti.programs (organization_id, primary_consultant_membership_id)
    WHERE primary_consultant_membership_id IS NOT NULL;

CREATE TABLE rti.enrollments (
    id UUID NOT NULL,
    organization_id UUID NOT NULL,
    program_id UUID NOT NULL,
    participant_membership_id UUID NOT NULL,
    status VARCHAR NOT NULL,
    approved_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT pk_enrollments PRIMARY KEY (id),
    CONSTRAINT uq_enrollments_organization_program_participant
        UNIQUE (organization_id, program_id, participant_membership_id),
    CONSTRAINT ck_enrollments_status CHECK (
        status IN (
            'PENDING_APPROVAL',
            'INVITED',
            'ACTIVE',
            'COMPLETED',
            'WITHDRAWN'
        )
    ),
    CONSTRAINT fk_enrollments_organization
        FOREIGN KEY (organization_id)
        REFERENCES rti.organizations (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_enrollments_program
        FOREIGN KEY (organization_id, program_id)
        REFERENCES rti.programs (organization_id, id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_enrollments_participant_membership
        FOREIGN KEY (organization_id, participant_membership_id)
        REFERENCES rti.organization_memberships (organization_id, id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_enrollments_participant_membership
    ON rti.enrollments (organization_id, participant_membership_id);

GRANT USAGE ON SCHEMA rti TO rti_app;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE
        rti.users,
        rti.organizations,
        rti.organization_memberships,
        rti.membership_roles,
        rti.programs,
        rti.enrollments
    TO rti_app;
