BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';

CREATE TEMP TABLE bootstrap_operator_input (
    subject text NOT NULL,
    email text NOT NULL,
    organization_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO bootstrap_operator_input (subject, email, organization_id)
VALUES (:'operator_subject', lower(:'operator_email'), :'operator_organization_id'::uuid);

DO $bootstrap$
DECLARE
    operator_subject text;
    operator_email text;
    configured_organization_id uuid;
    operator_user rti.users%ROWTYPE;
    operator_organization rti.organizations%ROWTYPE;
    operator_membership rti.organization_memberships%ROWTYPE;
    user_created boolean := false;
    organization_created boolean := false;
    membership_created boolean := false;
    identity_matches integer;
    organization_matches integer;
BEGIN
    SELECT subject, email, organization_id
      INTO operator_subject, operator_email, configured_organization_id
      FROM bootstrap_operator_input;

    IF current_database() <> 'refleja_tu_interior' OR current_user <> 'postgres'
       OR operator_subject !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR operator_email !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$' THEN
        RAISE EXCEPTION 'BOOTSTRAP_INVALID_DATABASE_OR_IDENTITY';
    END IF;

    LOCK TABLE rti.users, rti.organizations, rti.organization_memberships, rti.membership_roles
        IN SHARE ROW EXCLUSIVE MODE;

    SELECT count(*) INTO identity_matches
      FROM rti.users
     WHERE cognito_subject = operator_subject OR email_normalized = operator_email;

    IF identity_matches > 1 THEN
        RAISE EXCEPTION 'BOOTSTRAP_AMBIGUOUS_USER';
    END IF;

    SELECT * INTO operator_user
      FROM rti.users
     WHERE cognito_subject = operator_subject OR email_normalized = operator_email;

    IF NOT FOUND THEN
        IF EXISTS (SELECT 1 FROM rti.users) OR EXISTS (SELECT 1 FROM rti.organizations) THEN
            RAISE EXCEPTION 'BOOTSTRAP_NOT_AN_INITIAL_ENVIRONMENT';
        END IF;
        INSERT INTO rti.users
            (id, cognito_subject, email, email_normalized, status, created_at, updated_at, version)
        VALUES
            (uuidv7(), operator_subject, operator_email, operator_email, 'ACTIVE',
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
        RETURNING * INTO operator_user;
        user_created := true;
    ELSIF operator_user.cognito_subject <> operator_subject
       OR operator_user.email_normalized <> operator_email
       OR operator_user.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'BOOTSTRAP_USER_CONFLICT';
    END IF;

    SELECT count(*) INTO organization_matches
      FROM rti.organizations
     WHERE id = configured_organization_id
        OR name = 'Refleja Tu Interior'
        OR slug = 'refleja-tu-interior';

    IF organization_matches > 1 THEN
        RAISE EXCEPTION 'BOOTSTRAP_AMBIGUOUS_ORGANIZATION';
    END IF;

    SELECT * INTO operator_organization
      FROM rti.organizations
     WHERE id = configured_organization_id
        OR name = 'Refleja Tu Interior'
        OR slug = 'refleja-tu-interior';

    IF NOT FOUND THEN
        IF EXISTS (SELECT 1 FROM rti.organizations) THEN
            RAISE EXCEPTION 'BOOTSTRAP_ORGANIZATION_CONFLICT';
        END IF;
        INSERT INTO rti.organizations
            (id, name, slug, status, default_time_zone, created_at, updated_at, version)
        VALUES
            (configured_organization_id, 'Refleja Tu Interior', 'refleja-tu-interior',
             'ACTIVE', 'America/Bogota', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
        RETURNING * INTO operator_organization;
        organization_created := true;
    ELSIF operator_organization.id <> configured_organization_id
       OR operator_organization.name <> 'Refleja Tu Interior'
       OR operator_organization.slug IS DISTINCT FROM 'refleja-tu-interior'
       OR operator_organization.status <> 'ACTIVE'
       OR operator_organization.default_time_zone <> 'America/Bogota' THEN
        RAISE EXCEPTION 'BOOTSTRAP_ORGANIZATION_CONFLICT';
    END IF;

    SELECT * INTO operator_membership
      FROM rti.organization_memberships
     WHERE organization_id = operator_organization.id AND user_id = operator_user.id;

    IF NOT FOUND THEN
        INSERT INTO rti.organization_memberships
            (id, organization_id, user_id, status, joined_at, created_at, updated_at, version)
        VALUES
            (uuidv7(), operator_organization.id, operator_user.id, 'ACTIVE', CURRENT_TIMESTAMP,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
        RETURNING * INTO operator_membership;
        INSERT INTO rti.membership_roles (membership_id, role)
        VALUES (operator_membership.id, 'CONSULTANT');
        membership_created := true;
    ELSIF operator_membership.status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'BOOTSTRAP_MEMBERSHIP_CONFLICT';
    ELSIF NOT EXISTS (
        SELECT 1 FROM rti.membership_roles
         WHERE membership_id = operator_membership.id AND role = 'CONSULTANT'
    ) THEN
        RAISE EXCEPTION 'BOOTSTRAP_ROLE_REMOVED';
    END IF;

    PERFORM set_config('rti.bootstrap_result', json_build_object(
        'result', CASE WHEN user_created OR organization_created OR membership_created THEN 'created' ELSE 'unchanged' END,
        'userId', operator_user.id,
        'organizationId', operator_organization.id,
        'membershipId', operator_membership.id,
        'role', 'CONSULTANT'
    )::text, true);
END
$bootstrap$;

SELECT current_setting('rti.bootstrap_result');
COMMIT;
