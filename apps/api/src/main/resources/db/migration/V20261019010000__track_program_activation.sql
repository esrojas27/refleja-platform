ALTER TABLE rti.programs ADD COLUMN activated_at timestamp with time zone;

-- Preserve legacy programs that already reached an operational state. Drafts are
-- deliberately not promoted: their first activation remains an explicit action.
UPDATE rti.programs
SET activated_at = updated_at
WHERE status IN ('ACTIVE', 'COMPLETED');
