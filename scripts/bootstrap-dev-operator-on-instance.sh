#!/usr/bin/env bash
set -euo pipefail

operator_email="${1:?operator email is required}"
user_pool_id="${2:?Cognito user pool id is required}"
organization_id="${3:?operator organization id is required}"
aws_region="${4:?AWS region is required}"
application_root="/srv/refleja/application/current"
runtime_env="/srv/refleja/application/runtime/dev.env"
sql_file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sql/bootstrap-dev-operator.sql"

if [[ ! "${operator_email}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] ||
   [[ ! "${user_pool_id}" =~ ^${aws_region}_[A-Za-z0-9]+$ ]] ||
   [[ ! "${organization_id}" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] ||
   [[ ! -f "${application_root}/compose.dev.yml" ]] || [[ ! -f "${runtime_env}" ]] || [[ ! -f "${sql_file}" ]]; then
  echo "BOOTSTRAP_INVALID_CONFIGURATION" >&2
  exit 1
fi

cognito() {
  aws cognito-idp admin-get-user --region "${aws_region}" --user-pool-id "${user_pool_id}" \
    --username "${operator_email}" "$@"
}

read -r enabled user_status < <(cognito --query '[Enabled,UserStatus]' --output text)
subject="$(cognito --query "UserAttributes[?Name=='sub'].Value | [0]" --output text)"
resolved_email="$(cognito --query "UserAttributes[?Name=='email'].Value | [0]" --output text)"
email_verified="$(cognito --query "UserAttributes[?Name=='email_verified'].Value | [0]" --output text)"

if [[ "${enabled}" != "True" ]] || [[ "${user_status}" != "CONFIRMED" ]] ||
   [[ "${email_verified}" != "true" ]] || [[ "${resolved_email,,}" != "${operator_email,,}" ]] ||
   [[ ! "${subject}" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  echo "BOOTSTRAP_COGNITO_IDENTITY_NOT_CONFIRMED" >&2
  exit 1
fi

compose() {
  docker compose --project-directory "${application_root}" --env-file "${runtime_env}" \
    -f "${application_root}/compose.dev.yml" "$@"
}

postgres_id="$(compose ps -q postgres)"
if [[ ! "${postgres_id}" =~ ^[a-f0-9]{12,64}$ ]] ||
   [[ "$(docker inspect --format '{{.State.Health.Status}}' "${postgres_id}")" != "healthy" ]]; then
  echo "BOOTSTRAP_POSTGRES_NOT_HEALTHY" >&2
  exit 1
fi

docker exec -i "${postgres_id}" psql -X -U postgres -d refleja_tu_interior \
  -v ON_ERROR_STOP=1 -v operator_subject="${subject}" -v operator_email="${resolved_email,,}" \
  -v operator_organization_id="${organization_id}" -Atq <"${sql_file}"
