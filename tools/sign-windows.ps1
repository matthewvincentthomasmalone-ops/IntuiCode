# Signs one Windows file (an .exe or .msi) with the publisher's SSL.com eSigner certificate, using Jsign.
#
# Tauri runs this for every file it signs (bundle.windows.signCommand): the app, its uninstaller and the
# installers. Only the Desktop app workflow turns it on (.github/workflows/desktop.yml), and only when the
# repository has the eSigner secrets; local builds stay unsigned. SECURITY.md says how to set it up.
#
# From the environment:
#   JSIGN_JAR              Jsign, downloaded and checked by the workflow
#   ESIGNER_USERNAME       the SSL.com account's username
#   ESIGNER_PASSWORD       and its password
#   ESIGNER_CREDENTIAL_ID  the certificate's eSigner credential ID
#   ESIGNER_TOTP_SECRET    the base64 TOTP secret shown when the certificate was enrolled in eSigner
#   ESIGNER_ENDPOINT       optional: https://cs-try.ssl.com to sign with SSL.com's sandbox (test) certificate

param([Parameter(Mandatory = $true)][string]$File)
$ErrorActionPreference = 'Stop'

foreach ($name in 'JSIGN_JAR', 'ESIGNER_USERNAME', 'ESIGNER_PASSWORD', 'ESIGNER_CREDENTIAL_ID', 'ESIGNER_TOTP_SECRET') {
  if (-not [Environment]::GetEnvironmentVariable($name)) { throw "$name isn't set, so $File can't be signed." }
}

# The runner's own Java (Jsign needs 8 or newer)
$home_ = @($env:JAVA_HOME_21_X64, $env:JAVA_HOME_17_X64, $env:JAVA_HOME) |
  Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) } | Select-Object -First 1
$java = if ($home_) { Join-Path $home_ 'bin\java.exe' } else { 'java' }

$jsignArgs = @(
  '-jar', $env:JSIGN_JAR,
  '--storetype', 'ESIGNER',
  '--storepass', "$($env:ESIGNER_USERNAME)|$($env:ESIGNER_PASSWORD)",
  '--alias', $env:ESIGNER_CREDENTIAL_ID,
  '--keypass', $env:ESIGNER_TOTP_SECRET,
  '--alg', 'SHA-256',
  '--tsaurl', 'http://ts.ssl.com', '--tsmode', 'RFC3161', '--tsretries', '3', '--tsretrywait', '10',
  '--name', 'IntuaCode', '--url', 'https://github.com/matthewvincentthomasmalone-ops/IntuiCode'
)
if ($env:ESIGNER_ENDPOINT) { $jsignArgs += @('--keystore', $env:ESIGNER_ENDPOINT) }

& $java @jsignArgs $File
if ($LASTEXITCODE -ne 0) { throw "Jsign couldn't sign $File (exit code $LASTEXITCODE)." }
Write-Host "Signed $File"
