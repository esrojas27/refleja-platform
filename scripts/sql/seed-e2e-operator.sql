-- RTI-VS1-013 test fixture. It is not a Flyway migration or an application path.
-- Run only against a new, disposable refleja_tu_interior database.
\set ON_ERROR_STOP on
\getenv e2e_confirm RTI_E2E_CONFIRM
\getenv consultant_subject RTI_E2E_CONSULTANT_SUBJECT
\getenv consultant_email RTI_E2E_CONSULTANT_EMAIL
\getenv operator_organization_id OPERATOR_ORGANIZATION_ID

SELECT set_config('rti.e2e_confirm', :'e2e_confirm', false);
SELECT set_config('rti.e2e_consultant_subject', :'consultant_subject', false);
SELECT set_config('rti.e2e_consultant_email', :'consultant_email', false);
SELECT set_config('rti.e2e_operator_organization_id', :'operator_organization_id', false);

DO $seed$
DECLARE
    consultant_id uuid := uuidv7();
    operator_id uuid;
    membership_id uuid := uuidv7();
    consultant_subject text := current_setting('rti.e2e_consultant_subject');
    consultant_email text := lower(current_setting('rti.e2e_consultant_email'));
BEGIN
    IF current_setting('rti.e2e_confirm') <> 'true'
       OR current_database() <> 'refleja_tu_interior'
       OR current_user <> 'postgres' THEN
        RAISE EXCEPTION 'E2E_DISPOSABLE_DATABASE_CONFIRMATION_REQUIRED';
    END IF;
    operator_id := current_setting('rti.e2e_operator_organization_id')::uuid;
    IF consultant_subject !~* '^[0-9a-f-]{36}$'
       OR consultant_email !~ '^[^[:space:]<>@]+@[^[:space:]<>@]+\.[^[:space:]<>@]+$'
       OR EXISTS (SELECT FROM rti.users)
       OR EXISTS (SELECT FROM rti.organizations)
       OR EXISTS (SELECT FROM rti.programs)
       OR EXISTS (SELECT FROM rti.enrollments) THEN
        RAISE EXCEPTION 'E2E_NEW_DATABASE_AND_VALID_IDENTITY_REQUIRED';
    END IF;

    INSERT INTO rti.users
        (id, cognito_subject, email, email_normalized, first_name, last_name,
         status, created_at, updated_at, version)
    VALUES
        (consultant_id, consultant_subject, consultant_email, consultant_email,
         'MVP', 'Consultant', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

    INSERT INTO rti.organizations
        (id, name, slug, status, default_time_zone, created_at, updated_at, version)
    VALUES
        (operator_id, 'Refleja Tu Interior E2E', 'refleja-tu-interior-e2e',
         'ACTIVE', 'America/Bogota', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

    INSERT INTO rti.organization_memberships
        (id, organization_id, user_id, status, joined_at, created_at, updated_at, version)
    VALUES
        (membership_id, operator_id, consultant_id, 'ACTIVE', CURRENT_TIMESTAMP,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0);

    INSERT INTO rti.membership_roles (membership_id, role)
    VALUES (membership_id, 'CONSULTANT');
END
$seed$;

SELECT 'E2E_OPERATOR_SEEDED';
