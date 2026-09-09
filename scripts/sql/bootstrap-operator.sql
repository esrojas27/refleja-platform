-- Administrative development bootstrap, not a migration or application endpoint.
-- The CLI supplies transaction-local JSON after verifying Docker and Cognito.
DO $bootstrap$
DECLARE
    input jsonb := current_setting('rti.bootstrap_input')::jsonb;
    operator_user rti.users%ROWTYPE;
    operator_org rti.organizations%ROWTYPE;
    operator_membership rti.organization_memberships%ROWTYPE;
    org_count integer;
    outcome text := 'unchanged';
BEGIN
    IF current_database() <> 'refleja_tu_interior' OR current_user <> 'rti_app'
       OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
        RAISE EXCEPTION 'BOOTSTRAP_INVALID_DATABASE_ROLE';
    END IF;

    -- One short administrative transaction; prevents competing first bootstraps.
    LOCK TABLE rti.users, rti.organizations, rti.organization_memberships, rti.membership_roles
        IN SHARE ROW EXCLUSIVE MODE;

    SELECT * INTO operator_user FROM rti.users WHERE cognito_subject = input->>'subject';
    IF NOT FOUND OR operator_user.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'BOOTSTRAP_ACTIVE_INTERNAL_USER_REQUIRED';
    END IF;
    IF operator_user.email <> input->>'email'
       OR operator_user.email_normalized <> lower(input->>'email') THEN
        RAISE EXCEPTION 'BOOTSTRAP_PROFILE_MISMATCH';
    END IF;

    SELECT count(*) INTO org_count FROM rti.organizations
        WHERE name = 'Refleja Tu Interior' OR slug = 'refleja-tu-interior';
    IF org_count > 1 THEN
        RAISE EXCEPTION 'BOOTSTRAP_AMBIGUOUS_ORGANIZATION';
    END IF;

    IF org_count = 0 THEN
        IF EXISTS (SELECT 1 FROM rti.organizations) THEN
            RAISE EXCEPTION 'BOOTSTRAP_NOT_AN_INITIAL_ENVIRONMENT';
        END IF;
        INSERT INTO rti.organizations (id, name, slug, status, default_time_zone, created_at, updated_at, version)
        VALUES (uuidv7(), 'Refleja Tu Interior', 'refleja-tu-interior', 'ACTIVE',
                'America/Bogota', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
        RETURNING * INTO operator_org;

        INSERT INTO rti.organization_memberships
            (id, organization_id, user_id, status, joined_at, created_at, updated_at, version)
        VALUES (uuidv7(), operator_org.id, operator_user.id, 'ACTIVE',
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
        RETURNING * INTO operator_membership;

        INSERT INTO rti.membership_roles (membership_id, role)
        VALUES (operator_membership.id, 'CONSULTANT');
        outcome := 'created';
    ELSE
        SELECT * INTO operator_org FROM rti.organizations
            WHERE name = 'Refleja Tu Interior' OR slug = 'refleja-tu-interior';
        IF operator_org.name <> 'Refleja Tu Interior'
           OR operator_org.slug IS DISTINCT FROM 'refleja-tu-interior'
           OR operator_org.status <> 'ACTIVE'
           OR operator_org.default_time_zone <> 'America/Bogota' THEN
            RAISE EXCEPTION 'BOOTSTRAP_ORGANIZATION_CONFLICT';
        END IF;
        SELECT * INTO operator_membership FROM rti.organization_memberships
            WHERE organization_id = operator_org.id AND user_id = operator_user.id;
        IF NOT FOUND OR operator_membership.status <> 'ACTIVE' THEN
            RAISE EXCEPTION 'BOOTSTRAP_MEMBERSHIP_CONFLICT';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM rti.membership_roles
                       WHERE membership_id = operator_membership.id AND role = 'CONSULTANT') THEN
            RAISE EXCEPTION 'BOOTSTRAP_ROLE_REMOVED';
        END IF;
        -- Never re-enable revoked access, add another operator, or alter existing roles.
    END IF;

    PERFORM set_config('rti.bootstrap_result', json_build_object(
        'result', outcome, 'userId', operator_user.id, 'organizationId', operator_org.id,
        'membershipId', operator_membership.id, 'role', 'CONSULTANT'
    )::text, true);
END
$bootstrap$;
SELECT current_setting('rti.bootstrap_result');
