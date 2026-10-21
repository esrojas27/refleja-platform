#!/usr/bin/env bash
# Integration test for an EMPTY GitHub-hosted Linux runner, never DEV.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && ! -e /srv/refleja/application ]] || {
  echo 'This test requires a disposable GitHub runner without an application directory.' >&2
  exit 1
}
test_dir=$(mktemp -d)
export RTI_BACKUP_TEST_STORE="${test_dir}/objects"
export RTI_BACKUP_CONFIG="${test_dir}/config"
mkdir -p "${test_dir}/bin" "${RTI_BACKUP_TEST_STORE}"
export PATH="${test_dir}/bin:${PATH}"
cat >"${RTI_BACKUP_CONFIG}" <<'CONF'
BACKUP_BUCKET=test-bucket
AWS_REGION=us-east-1
BACKUP_TOPIC_ARN=arn:aws:sns:us-east-1:123456789012:test
CONF
# Fake only AWS transport/telemetry. Dump, SHA checks and restoration use real
# PostgreSQL 18 and Docker, including owner/ACL, RLS and constraint restoration.
cat >"${test_dir}/bin/aws" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
case "$1 $2" in
  's3 cp')
    if [[ "$3" == s3://* ]]; then
      cp "${RTI_BACKUP_TEST_STORE}/${3#s3://test-bucket/}" "$4"
    else
      [[ "${RTI_TEST_FAIL_UPLOAD:-0}" != 1 ]] || exit 44
      target="${RTI_BACKUP_TEST_STORE}/${4#s3://test-bucket/}"
      mkdir -p "$(dirname "${target}")"
      cp "$3" "${target}"
      sha256sum "$3" | cut -d' ' -f1 >"${target}.sha"
    fi ;;
  's3api head-object')
    while [[ "$1" != --key ]]; do shift; done
    if [[ "${RTI_TEST_BAD_DIGEST:-0}" == 1 ]]; then
      printf '%064d\n' 0
    else
      cat "${RTI_BACKUP_TEST_STORE}/$2.sha"
    fi ;;
  'cloudwatch put-metric-data') echo success >>"${RTI_BACKUP_TEST_STORE}/metric.log" ;;
  'sns publish') echo alert >>"${RTI_BACKUP_TEST_STORE}/alerts.log" ;;
  *) echo 'Unexpected AWS request in test' >&2; exit 1 ;;
esac
MOCK
chmod 0755 "${test_dir}/bin/aws"
release=/srv/refleja/application/releases/0000000000000000000000000000000000000000
mkdir -p "${release}"
ln -s "${release}" /srv/refleja/application/current
fixture="rti-backup-test-$$"
trap 'docker rm -f -v "${fixture}" >/dev/null 2>&1 || true' EXIT
docker run -d --name "${fixture}" --network none \
  --label com.docker.compose.project=refleja-tu-interior-dev \
  --label com.docker.compose.service=postgres \
  --health-cmd='pg_isready -U postgres -d refleja_tu_interior' --health-interval=1s \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=refleja_tu_interior postgres:18.0-alpine >/dev/null
ready=0
for _ in $(seq 1 60); do
  if docker exec "${fixture}" psql -X -h 127.0.0.1 -U postgres -d refleja_tu_interior -Atqc 'SELECT 1' >/dev/null 2>&1 \
    && [[ "$(docker inspect -f '{{.State.Health.Status}}' "${fixture}")" == healthy ]]; then ready=1; break; fi
  sleep 1
done
[[ "${ready}" == 1 ]]
docker exec -i "${fixture}" psql -X -U postgres -d refleja_tu_interior -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
CREATE ROLE rti_migrator LOGIN PASSWORD 'fixture-only';
CREATE ROLE rti_app LOGIN PASSWORD 'fixture-only';
CREATE SCHEMA rti AUTHORIZATION rti_migrator;
SET ROLE rti_migrator;
CREATE TABLE rti.flyway_schema_history(installed_rank int PRIMARY KEY, version text, checksum int, success boolean);
INSERT INTO rti.flyway_schema_history VALUES (1, '20261020010000', 12345, true);
CREATE TABLE rti.organizations(id int PRIMARY KEY);
INSERT INTO rti.organizations VALUES (1), (2);
CREATE TABLE rti.responses(id int PRIMARY KEY, organization_id int REFERENCES rti.organizations(id), response text);
INSERT INTO rti.responses VALUES (1, 1, 'Synthetic only'), (2, 2, 'Different tenant');
ALTER TABLE rti.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rti.responses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant ON rti.responses USING (organization_id = nullif(current_setting('rti.organization_id', true), '')::int);
GRANT USAGE ON SCHEMA rti TO rti_app;
GRANT SELECT ON rti.responses TO rti_app;
SQL
bash scripts/dev-database-backup.sh backup test >"${test_dir}/result"
key=$(sed -n 's/^BACKUP_OK key=\([^ ]*\).*/\1/p' "${test_dir}/result")
[[ -n "${key}" ]]
bash scripts/dev-database-backup.sh verify "${key}"
[[ -z "$(docker ps -aq --filter label=rti.purpose=restore-drill)" ]]
[[ -z "$(find /srv/refleja/application/runtime/backup-tmp -mindepth 1 -print -quit)" ]]

# Reject invalid destinations and corrupted downloads before creating a target.
if bash scripts/dev-database-backup.sh verify 'deployments/not-a-backup.tar'; then exit 1; fi
if RTI_TEST_BAD_DIGEST=1 bash scripts/dev-database-backup.sh verify "${key}"; then exit 1; fi
if RTI_TEST_FAIL_UPLOAD=1 bash scripts/dev-database-backup.sh backup test; then exit 1; fi
[[ "$(wc -l <"${RTI_BACKUP_TEST_STORE}/metric.log")" == 1 ]]
[[ "$(wc -l <"${RTI_BACKUP_TEST_STORE}/alerts.log")" == 3 ]]
[[ -z "$(docker ps -aq --filter label=rti.purpose=restore-drill)" ]]
[[ -z "$(find /srv/refleja/application/runtime/backup-tmp -mindepth 1 -print -quit)" ]]
[[ "$(docker exec "${fixture}" psql -X -U postgres -d refleja_tu_interior -Atqc 'SELECT count(*) FROM rti.responses')" == 2 ]]
echo 'BACKUP_TEST_OK: restore, cleanup, checksum rejection, destination guard and upload failure.'
