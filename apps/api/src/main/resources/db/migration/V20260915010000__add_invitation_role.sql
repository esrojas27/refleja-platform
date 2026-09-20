-- The invitation records the organization role that will be granted on acceptance.
-- Existing invitations were collaborator invitations and are backfilled accordingly.
ALTER TABLE rti.user_invitations ADD COLUMN invited_role VARCHAR;

UPDATE rti.user_invitations SET invited_role = 'COLLABORATOR';

ALTER TABLE rti.user_invitations
    ALTER COLUMN invited_role SET NOT NULL,
    ADD CONSTRAINT ck_user_invitations_invited_role
        CHECK (invited_role IN ('COLLABORATOR', 'LEADER', 'COMPANY_ADMIN'));
