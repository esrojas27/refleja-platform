#!/usr/bin/env bash
# Runs as root on DEV. Never restores into the application database.
set -Eeuo pipefail
umask 077

mode="${1:-backup}"
reason="${2:-manual}"
config="${RTI_BACKUP_CONFIG:-/etc/refleja-backup.conf}"
[[ -f "${config}" ]] || { echo 'Backup configuration missing.' >&2; exit 1; }
# Root-owned file installed from Terraform outputs, not a downloaded backup.
# shellcheck source=/dev/null
source "${config}"
: "${BACKUP_BUCKET:?}" "${AWS_REGION:?}" "${BACKUP_TOPIC_ARN:?}"
export AWS_DEFAULT_REGION="${AWS_REGION}" AWS_PAGER=""
root=/srv/refleja/application
work=""
restore_container=""
snapshot_pid=""
started=$(date +%s)

cleanup() {
  local result=$?
  trap - EXIT
  if [[ -n "${snapshot_pid}" ]]; then
    printf 'ROLLBACK;\n\\q\n' 1>&"${snapshot_input}" 2>/dev/null || true
    wait "${snapshot_pid}" 2>/dev/null || true
  fi
  if [[ -n "${restore_container}" ]]; then
    if ! docker rm -f -v "${restore_container}" >/dev/null 2>&1; then
      echo 'Could not remove disposable restore container; preserving its directory for operator cleanup.' >&2
      work=""
      result=1
    fi
  fi
  # mktemp creates the only directory we may remove; never a project/DB volume.
  if [[ "${work}" == "${root}/runtime/backup-tmp/"* && -d "${work}" ]]; then
    rm -rf -- "${work}"
  fi
  if (( result != 0 )); then
    echo "DEV database ${mode} failed. See journal/SSM output; no restore to DEV was attempted." >&2
    aws sns publish --topic-arn "${BACKUP_TOPIC_ARN}" --subject 'Refleja DEV: fallo de respaldo/restauracion' \
      --message "Operacion ${mode} fallida en DEV. Revisar journalctl -u refleja-backup.service o el comando SSM. No se ha restaurado sobre DEV." >/dev/null || true
  fi
  exit "${result}"
}
trap cleanup EXIT

[[ "${mode}" == backup || "${mode}" == verify ]] || { echo 'Use backup [reason] or verify [S3 key].' >&2; exit 1; }
mkdir -p "${root}/runtime/backup-tmp"
# Deployment holds this same lock, passing its open FD to the pre-deploy copy.
if [[ "${RTI_BACKUP_LOCK_HELD:-0}" != 1 ]]; then
  exec 9>"${root}/runtime/maintenance.lock"
  flock -w 900 9
fi
work=$(mktemp -d "${root}/runtime/backup-tmp/run.XXXXXXXX")

if [[ "${mode}" == backup ]]; then
  [[ "${reason}" =~ ^[a-z-]+$ ]]
  release=$(readlink -f "${root}/current")
  [[ "${release}" =~ ^/srv/refleja/application/releases/[0-9a-f]{40}$ ]]
  container=$(docker ps -q --filter label=com.docker.compose.project=refleja-tu-interior-dev --filter label=com.docker.compose.service=postgres)
  [[ -n "${container}" && "${container}" != *$'\n'* ]]
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "${container}")" == healthy ]]
  mkdir "${work}/payload"
  payload="${work}/payload"
  db=$(docker exec "${container}" printenv POSTGRES_DB)
  [[ "${db}" =~ ^[a-zA-Z_][a-zA-Z_0-9]*$ ]]
  db_bytes=$(docker exec "${container}" psql -X -U postgres -d "${db}" -Atqc 'SELECT pg_database_size(current_database())')
  free_bytes=$(df -PB1 "${work}" | awk 'NR==2 {print $4}')
  (( free_bytes > db_bytes * 3 + 1073741824 )) || { echo 'Insufficient free disk for a safe backup.' >&2; exit 1; }
  image=$(docker inspect -f '{{.Config.Image}}' "${container}")
  [[ "${image}" == postgres:18.* ]]
  # Both pg_dump and the row-count manifest use ONE consistent MVCC snapshot.
  coproc SNAPSHOT { docker exec -i "${container}" psql -X -U postgres -d "${db}" -Atq -v ON_ERROR_STOP=1; }
  snapshot_pid=${SNAPSHOT_PID}
  snapshot_input=${SNAPSHOT[1]}
  printf 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n' >&"${snapshot_input}"
  read -r snapshot <&"${SNAPSHOT[0]}"
  [[ "${snapshot}" =~ ^[0-9A-F-]+$ ]]
  docker exec "${container}" pg_dump -U postgres -d "${db}" -Fc --snapshot="${snapshot}" --lock-wait-timeout=30s >"${payload}/database.dump"
  docker exec "${container}" pg_dumpall -U postgres --roles-only --no-role-passwords >"${payload}/roles.sql"
  cat >"${payload}/verify.sql" <<'SQL'
SELECT format('SELECT %L || ''|'' || count(*) FROM %I.%I;', 'rows|' || schemaname || '.' || tablename, schemaname, tablename)
FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') ORDER BY schemaname, tablename
\gexec
SELECT 'rls|' || n.nspname || '.' || c.relname || '|' || c.relrowsecurity || '|' || c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='rti' AND c.relkind='r' ORDER BY c.relname;
SELECT 'policy|' || schemaname || '.' || tablename || '|' || policyname || '|' || roles::text || '|' || cmd || '|' || coalesce(qual,'') || '|' || coalesce(with_check,'') FROM pg_policies ORDER BY schemaname,tablename,policyname;
SELECT 'role|' || rolname || '|' || rolsuper || '|' || rolbypassrls FROM pg_roles WHERE rolname IN ('rti_app','rti_migrator') ORDER BY rolname;
SELECT 'migration|' || version || '|' || checksum || '|' || success FROM rti.flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank;
SQL
  { printf "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET TRANSACTION SNAPSHOT '%s';\n" "${snapshot}"; cat "${payload}/verify.sql"; printf '\nCOMMIT;\n'; } \
    | docker exec -i "${container}" psql -X -U postgres -d "${db}" -Atq -v ON_ERROR_STOP=1 >"${payload}/expected.txt"
  printf 'COMMIT;\n\\q\n' >&"${snapshot_input}"
  wait "${snapshot_pid}"
  snapshot_pid=""
  test -s "${payload}/database.dump"
  grep -q '^migration|' "${payload}/expected.txt"
  printf '%s\n' "${release##*/}" >"${payload}/release.txt"
  printf '%s\n' "${image}" >"${payload}/image.txt"
  printf '%s\n' "${db}" >"${payload}/database-name.txt"
  printf '%s\n' "${db_bytes}" >"${payload}/database-bytes.txt"
  date -u +%FT%TZ >"${payload}/captured-at.txt"
  (cd "${payload}"; sha256sum database.dump roles.sql verify.sql expected.txt release.txt image.txt database-name.txt database-bytes.txt captured-at.txt >SHA256SUMS)
  tar -C "${payload}" -cf "${work}/backup.tar" .
  digest=$(sha256sum "${work}/backup.tar" | cut -d' ' -f1)
  key="backups/postgres/$(date -u +%Y/%m/%d)/$(date -u +%Y%m%dT%H%M%SZ)-${reason}-${work##*.}.tar"
  aws s3 cp "${work}/backup.tar" "s3://${BACKUP_BUCKET}/${key}" --sse AES256 --metadata "sha256=${digest}" --only-show-errors
  remote_digest=$(aws s3api head-object --bucket "${BACKUP_BUCKET}" --key "${key}" --query Metadata.sha256 --output text)
  [[ "${remote_digest}" == "${digest}" ]]
  aws cloudwatch put-metric-data --namespace Refleja/Backup --metric-name Success --value 1 --unit Count --dimensions Environment=development
  printf 'BACKUP_OK key=%s bytes=%s elapsed_seconds=%s release=%s\n' "${key}" "$(stat -c %s "${work}/backup.tar")" "$(( $(date +%s) - started ))" "${release##*/}"
else
  key="${reason}"
  [[ "${key}" =~ ^backups/postgres/[0-9]{4}/[0-9]{2}/[0-9]{2}/[a-zA-Z0-9-]+\.tar$ ]] || { echo 'An explicit backups/postgres/ S3 key is required.' >&2; exit 1; }
  digest=$(aws s3api head-object --bucket "${BACKUP_BUCKET}" --key "${key}" --query Metadata.sha256 --output text)
  [[ "${digest}" =~ ^[0-9a-f]{64}$ ]]
  aws s3 cp "s3://${BACKUP_BUCKET}/${key}" "${work}/backup.tar" --only-show-errors
  [[ "$(sha256sum "${work}/backup.tar" | cut -d' ' -f1)" == "${digest}" ]]
  mkdir "${work}/payload" "${work}/pgdata"
  # PostgreSQL 18 switches to postgres after preparing PGDATA/18/docker. That
  # user must traverse the mount root; the enclosing host work dir stays 0700.
  chmod 0755 "${work}/pgdata"
  # Extract a fixed allowlist. Never execute config or select a target from an archive.
  tar -xf "${work}/backup.tar" -C "${work}/payload" --no-same-owner --no-same-permissions \
    ./database.dump ./roles.sql ./verify.sql ./expected.txt ./release.txt ./image.txt ./database-name.txt ./database-bytes.txt ./captured-at.txt ./SHA256SUMS
  payload="${work}/payload"
  (cd "${payload}"; sha256sum --check --status SHA256SUMS)
  db_bytes=$(cat "${payload}/database-bytes.txt")
  [[ "${db_bytes}" =~ ^[0-9]+$ ]]
  free_bytes=$(df -PB1 "${work}" | awk 'NR==2 {print $4}')
  (( free_bytes > db_bytes * 3 + 1073741824 )) || { echo 'Insufficient free disk for isolated restoration.' >&2; exit 1; }
  available_kib=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
  (( available_kib > 262144 )) || { echo 'Restore drill requires at least 256 MiB available memory.' >&2; exit 1; }
  image=$(cat "${payload}/image.txt")
  [[ "${image}" =~ ^postgres:18\.[0-9]+-alpine$ ]]
  # Only the already-cached official major-version image; never pull code from backup metadata.
  docker image inspect "${image}" >/dev/null
  restore_container="rti-restore-check-${work##*.}"
  docker run -d --name "${restore_container}" --label rti.purpose=restore-drill --network none \
    --memory 192m --cpus 0.25 --pids-limit 128 --security-opt no-new-privileges:true \
    -e POSTGRES_USER=rti_restore_operator -e POSTGRES_DB=restore_check -e POSTGRES_HOST_AUTH_METHOD=trust \
    -v "${work}/pgdata:/var/lib/postgresql" "${image}" >/dev/null
  ready=0
  for _ in $(seq 1 60); do
    if [[ "$(docker inspect -f '{{.State.Running}}' "${restore_container}")" != true ]]; then
      docker logs --tail 25 "${restore_container}" >&2
      exit 1
    fi
    # The entrypoint's temporary init server accepts Unix sockets before it
    # creates the database. Wait for a real query on the final TCP listener.
    if docker exec "${restore_container}" psql -X -h 127.0.0.1 -U rti_restore_operator -d restore_check -Atqc 'SELECT 1' >/dev/null 2>&1; then ready=1; break; fi
    sleep 2
  done
  [[ "${ready}" == 1 ]]
  docker exec -i "${restore_container}" psql -X -U rti_restore_operator -d restore_check -v ON_ERROR_STOP=1 <"${payload}/roles.sql" >/dev/null
  docker exec -i "${restore_container}" pg_restore -U rti_restore_operator -d restore_check --exit-on-error --single-transaction <"${payload}/database.dump"
  docker exec -i "${restore_container}" psql -X -U rti_restore_operator -d restore_check -Atq -v ON_ERROR_STOP=1 <"${payload}/verify.sql" >"${work}/actual.txt"
  cmp --silent "${payload}/expected.txt" "${work}/actual.txt" || { echo 'Restored rows, migrations, roles or RLS differ from backup snapshot.' >&2; exit 1; }
  printf 'RESTORE_OK key=%s tables=%s elapsed_seconds=%s network=none target=disposable\n' "${key}" "$(grep -c '^rows|' "${work}/actual.txt")" "$(( $(date +%s) - started ))"
fi
