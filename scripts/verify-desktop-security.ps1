$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$tauriDirectory = Join-Path $repositoryRoot "crates\dream-builder"
$configPath = Join-Path $tauriDirectory "tauri.conf.json"
$capabilityPath = Join-Path $tauriDirectory "capabilities\default.json"
$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$capability = Get-Content -LiteralPath $capabilityPath -Raw -Encoding UTF8 | ConvertFrom-Json

if ([string]$config.build.devUrl -ne "http://127.0.0.1:1420") {
    throw "The desktop development URL must stay on the fixed loopback origin."
}

$csp = [string]$config.app.security.csp
if ($csp -notmatch "(?:^|;)\s*default-src\s+'self'(?:\s*;|$)") {
    throw "The desktop CSP must default to same-origin content."
}
if ($csp -match "'unsafe-eval'" -or $csp -match '(?:^|[ ;])\*(?:[ ;]|$)') {
    throw "The desktop CSP must not allow unsafe evaluation or wildcard sources."
}
foreach ($match in [regex]::Matches($csp, 'https?://([^\s;]+)')) {
    if ($match.Groups[1].Value -notin @("asset.localhost", "ipc.localhost")) {
        throw "The desktop CSP contains an unexpected remote origin: $($match.Value)"
    }
}

$permissionIds = @(
    foreach ($permission in $capability.permissions) {
        if ($permission -is [string]) {
            $permission
        } else {
            [string]$permission.identifier
        }
    }
)
$expectedPermissionIds = @(
    "core:default"
    "core:window:allow-close"
    "dialog:allow-save"
    "opener:allow-reveal-item-in-dir"
    "opener:allow-open-path"
)
$missingPermissions = @($expectedPermissionIds | Where-Object { $_ -notin $permissionIds })
$unexpectedPermissions = @($permissionIds | Where-Object { $_ -notin $expectedPermissionIds })
if ($missingPermissions.Count -gt 0 -or $unexpectedPermissions.Count -gt 0) {
    throw "Desktop permissions must stay least-privilege. Missing: $($missingPermissions -join ', '); unexpected: $($unexpectedPermissions -join ', ')"
}

$openPathPermission = @(
    $capability.permissions |
        Where-Object { $_ -isnot [string] -and [string]$_.identifier -eq "opener:allow-open-path" }
)
if ($openPathPermission.Count -ne 1) {
    throw "Expected one scoped opener:allow-open-path permission."
}
$openPathScopes = @($openPathPermission[0].allow | ForEach-Object { [string]$_.path } | Sort-Object)
if (($openPathScopes -join "|") -ne '$APPLOG|$APPLOG/**') {
    throw "Opening paths must stay limited to the application log directory."
}

$cargoManifest = Get-Content -LiteralPath (Join-Path $tauriDirectory "Cargo.toml") -Raw -Encoding UTF8
$rustBootstrap = Get-Content -LiteralPath (Join-Path $tauriDirectory "src\lib.rs") -Raw -Encoding UTF8
if ($cargoManifest -match '(?m)^tauri-plugin-fs\s*=' -or $rustBootstrap -match 'tauri_plugin_fs') {
    throw "The unused filesystem plugin must not be exposed by the desktop application."
}

Write-Host "Desktop security contract verified:" -ForegroundColor Green
[pscustomobject]@{
    Origin = $config.build.devUrl
    CSP = "same-origin; no unsafe-eval or wildcard sources"
    WebviewPermissions = ($permissionIds -join ", ")
    OpenPathScope = ($openPathScopes -join ", ")
} | Format-List
