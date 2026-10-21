#!/usr/bin/env bash
set -euo pipefail
umask 077
source_script="${1:?backup script path}"
bucket="${2:?backup bucket}"
region="${3:?region}"
topic="${4:?SNS topic ARN}"
[[ "${bucket}" =~ ^[a-z0-9-]+$ && "${region}" =~ ^[a-z]+-[a-z]+-[0-9]+$ ]]
[[ "${topic}" =~ ^arn:aws:sns:[a-z0-9-]+:[0-9]{12}:[a-zA-Z0-9_-]+$ ]]
script_tmp=$(mktemp /usr/local/sbin/.refleja-backup.XXXXXXXX)
config_tmp=$(mktemp /etc/.refleja-backup.XXXXXXXX)
trap 'rm -f -- "${script_tmp}" "${config_tmp}"' EXIT
install -m 0700 "${source_script}" "${script_tmp}"
mv -f "${script_tmp}" /usr/local/sbin/refleja-db-backup
printf 'BACKUP_BUCKET=%s\nAWS_REGION=%s\nBACKUP_TOPIC_ARN=%s\n' "${bucket}" "${region}" "${topic}" >"${config_tmp}"
chmod 0600 "${config_tmp}"
mv -f "${config_tmp}" /etc/refleja-backup.conf
cat >/etc/systemd/system/refleja-backup.service <<'UNIT'
[Unit]
Description=Refleja DEV PostgreSQL backup to S3
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/refleja-db-backup backup scheduled
TimeoutStartSec=45min
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
UMask=0077
UNIT
cat >/etc/systemd/system/refleja-backup.timer <<'UNIT'
[Unit]
Description=Backup during DEV hours and after startup

[Timer]
OnBootSec=15min
OnCalendar=Mon..Fri *-*-* 19:00:00 America/Bogota
Persistent=true
RandomizedDelaySec=60
Unit=refleja-backup.service

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now refleja-backup.timer
