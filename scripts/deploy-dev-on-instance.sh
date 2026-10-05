#!/usr/bin/env bash
set -euo pipefail

release_dir="${1:?release directory is required}"
parameter_path="${2:-/refleja-tu-interior/dev}"
aws_region="${3:-us-east-1}"
application_root="/srv/refleja/application"
runtime_dir="${application_root}/runtime"
runtime_env="${runtime_dir}/dev.env"
current_link="${application_root}/current"
previous_release=""

if [[ ! "${release_dir}" =~ ^/srv/refleja/application/releases/[0-9a-f]{40}$ ]]; then
  echo "Invalid release directory." >&2
  exit 1
fi

if [[ -L "${current_link}" ]]; then
  previous_release="$(readlink -f "${current_link}")"
fi

get_parameter() {
  aws ssm get-parameter \
    --region "${aws_region}" \
    --name "${parameter_path}/$1" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text
}

mkdir -p "${runtime_dir}"
runtime_tmp="$(mktemp "${runtime_dir}/dev.env.XXXXXX")"
trap 'rm -f "${runtime_tmp}"' EXIT

cat "${release_dir}/dev.env.public" >"${runtime_tmp}"
printf 'POSTGRES_SUPERUSER_PASSWORD=%s\n' "$(get_parameter POSTGRES_SUPERUSER_PASSWORD)" >>"${runtime_tmp}"
printf 'RTI_MIGRATOR_PASSWORD=%s\n' "$(get_parameter RTI_MIGRATOR_PASSWORD)" >>"${runtime_tmp}"
printf 'RTI_APP_PASSWORD=%s\n' "$(get_parameter RTI_APP_PASSWORD)" >>"${runtime_tmp}"
printf 'INVITATIONS_SES_FROM=%s\n' "$(get_parameter INVITATIONS_SES_FROM)" >>"${runtime_tmp}"
chmod 0600 "${runtime_tmp}"
mv -f "${runtime_tmp}" "${runtime_env}"

compose() {
  docker compose \
    --project-directory "$1" \
    --env-file "${runtime_env}" \
    -f "$1/compose.dev.yml" "${@:2}"
}

rollback() {
  local exit_code=$?
  if [[ -n "${previous_release}" && -f "${previous_release}/compose.dev.yml" ]]; then
    echo "Deployment failed; restoring previous release." >&2
    compose "${previous_release}" up -d --remove-orphans || true
    ln -sfn "${previous_release}" "${current_link}"
  fi
  exit "${exit_code}"
}
trap rollback ERR

registry="$(awk -F= '/^API_IMAGE=/{print $2}' "${release_dir}/dev.env.public" | cut -d/ -f1)"
aws ecr get-login-password --region "${aws_region}" | docker login --username AWS --password-stdin "${registry}"

compose "${release_dir}" pull
compose "${release_dir}" up -d --remove-orphans

for attempt in $(seq 1 60); do
  unhealthy=0
  for service in postgres api web proxy; do
    container_id="$(compose "${release_dir}" ps -q "${service}")"
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
    [[ "${status}" == "healthy" ]] || unhealthy=1
  done
  if [[ "${unhealthy}" -eq 0 ]]; then
    ln -sfn "${release_dir}" "${current_link}"
    trap - ERR
    find "${application_root}/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
      | sort -nr | tail -n +4 | cut -d' ' -f2- | xargs -r rm -rf
    docker image prune -f --filter 'until=168h' >/dev/null
    echo "DEV deployment healthy."
    exit 0
  fi
  sleep 5
done

compose "${release_dir}" ps
compose "${release_dir}" logs --tail 200
echo "Services did not become healthy in time." >&2
exit 1
