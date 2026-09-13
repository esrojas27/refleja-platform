-- Identity owns invitations; Participation references them only through UUIDs.
-- No backfill invents invitations for enrollments created before RTI-VS1-010.
ALTER TABLE rti.organization_memberships
    ADD CONSTRAINT uq_memberships_organization_id_user UNIQUE (organization_id, id, user_id);

CREATE TABLE rti.user_invitations (
    id UUID NOT NULL PRIMARY KEY,
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    membership_id UUID NOT NULL,
    invited_by UUID NOT NULL,
    cognito_username VARCHAR NOT NULL,
    status VARCHAR NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    delivery_status VARCHAR NOT NULL CHECK (delivery_status IN ('PENDING', 'SENDING', 'SENT', 'FAILED')),
    delivery_lease_until TIMESTAMPTZ,
    delivery_attempt_id UUID,
    credentials_sent_at TIMESTAMPTZ,
    ses_message_id VARCHAR,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL,
    CONSTRAINT uq_invitations_organization_id_member UNIQUE (organization_id, id, membership_id),
    CONSTRAINT fk_invitations_organization FOREIGN KEY (organization_id)
        REFERENCES rti.organizations (id) ON DELETE RESTRICT,
    CONSTRAINT fk_invitations_user FOREIGN KEY (user_id)
        REFERENCES rti.users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_invitations_inviter FOREIGN KEY (invited_by)
        REFERENCES rti.users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_invitations_membership_user FOREIGN KEY (organization_id, membership_id, user_id)
        REFERENCES rti.organization_memberships (organization_id, id, user_id) ON DELETE RESTRICT
);

CREATE INDEX idx_invitations_user_id ON rti.user_invitations (user_id, id DESC);
CREATE INDEX idx_invitations_organization_id ON rti.user_invitations (organization_id, id);

ALTER TABLE rti.enrollments ADD COLUMN invitation_id UUID;
ALTER TABLE rti.enrollments
    ADD CONSTRAINT uq_enrollments_invitation UNIQUE (invitation_id),
    ADD CONSTRAINT fk_enrollments_invitation_member
        FOREIGN KEY (organization_id, invitation_id, participant_membership_id)
        REFERENCES rti.user_invitations (organization_id, id, membership_id) ON DELETE RESTRICT;
CREATE INDEX idx_enrollments_organization_program_id
    ON rti.enrollments (organization_id, program_id, id DESC);

GRANT SELECT, INSERT, UPDATE ON TABLE rti.user_invitations TO rti_app;
