#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('List', 'Status', 'Backup', 'Verify')]
    [string]$Action = 'Status',
    [string]$BackupKey,
    [string]$Profile = 'rti-dev',
    [string]$Region = 'us-east-1',
    [string]$InstanceId = 'i-08493bca78a5098f7',
    [string]$Bucket = 'rti-dev-backups-836528258662'
)
$ErrorActionPreference = 'Stop'
$env:AWS_PAGER = ''
$env:PYTHONIOENCODING = 'utf-8'
function Invoke-BackupAws {
    param([string[]]$AwsArguments)
    $result = & aws @AwsArguments --profile $Profile --region $Region
    if ($LASTEXITCODE -ne 0) { throw "AWS command failed ($LASTEXITCODE). Check SSO login and permissions." }
    return $result
}
if ($Action -eq 'List') {
    Invoke-BackupAws @('s3api', 'list-objects-v2', '--bucket', $Bucket, '--prefix', 'backups/postgres/',
        '--query', 'sort_by(Contents,&LastModified)[].{Key:Key,Bytes:Size,Created:LastModified}', '--output', 'table')
    return
}
switch ($Action) {
    'Status' { $commands = @('systemctl list-timers refleja-backup.timer --no-pager', 'journalctl -u refleja-backup.service -n 15 --no-pager') }
    'Backup' { $commands = @('set -euo pipefail', '/usr/local/sbin/refleja-db-backup backup manual') }
    'Verify' {
        if ($BackupKey -cnotmatch '^backups/postgres/[0-9]{4}/[0-9]{2}/[0-9]{2}/[a-zA-Z0-9-]+\.tar$') {
            throw 'Specify the exact BackupKey from -Action List. Verification always uses a disposable database.'
        }
        $commands = @('set -euo pipefail', "/usr/local/sbin/refleja-db-backup verify $BackupKey")
    }
}
$parameters = @{ commands = $commands; executionTimeout = @('2700') } | ConvertTo-Json -Compress
$commandId = Invoke-BackupAws @('ssm', 'send-command', '--instance-ids', $InstanceId,
    '--document-name', 'AWS-RunShellScript', '--comment', "Refleja DEV database $Action",
    '--parameters', $parameters, '--query', 'Command.CommandId', '--output', 'text')
Write-Host "SSM command: $commandId"
for ($attempt = 0; $attempt -lt 550; $attempt++) {
    Start-Sleep -Seconds 5
    $response = Invoke-BackupAws @('ssm', 'get-command-invocation', '--command-id', $commandId,
        '--instance-id', $InstanceId, '--output', 'json')
    $invocation = ($response -join "`n") | ConvertFrom-Json
    if ($invocation.Status -in @('Pending', 'InProgress', 'Delayed')) { continue }
    Write-Output $invocation.StandardOutputContent
    if ($invocation.StandardErrorContent) { Write-Host $invocation.StandardErrorContent }
    if ($invocation.Status -ne 'Success') { throw "Operation ended with status $($invocation.Status)." }
    return
}
throw "Still running. Inspect command $commandId in Systems Manager; do not start another restore drill."
