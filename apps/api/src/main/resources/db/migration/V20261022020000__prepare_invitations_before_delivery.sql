-- Existing invitations keep their delivery state. New registrations are private drafts
-- until a consultant explicitly requests delivery; their seven-day validity starts then.
ALTER TABLE rti.user_invitations DROP CONSTRAINT user_invitations_status_check;
ALTER TABLE rti.user_invitations
    ADD CONSTRAINT user_invitations_status_check
        CHECK (status IN ('DRAFT', 'PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE rti.user_invitations
    ADD CONSTRAINT ck_invitation_delivery_validity CHECK (
        (status = 'DRAFT' AND expires_at IS NULL AND delivery_status = 'PENDING')
        OR (status = 'REVOKED')
        OR (status IN ('PENDING', 'ACCEPTED', 'EXPIRED') AND expires_at IS NOT NULL));
