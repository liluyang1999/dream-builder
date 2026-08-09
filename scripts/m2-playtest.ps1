[CmdletBinding()]
param(
    [string]$ManifestPath = "",
    [switch]$Launch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $repoRoot "docs\game\evidence\m2-target-build.json"
}

function Get-RequiredPropertyValue {
    param(
        [Parameter(Mandatory = $true)]
        [object]$InputObject,
        [Parameter(Mandatory = $true)]
        [string]$PropertyName,
        [Parameter(Mandatory = $true)]
        [string]$ObjectPath
    )

    $property = $InputObject.PSObject.Properties[$PropertyName]
    if ($null -eq $property -or $null -eq $property.Value) {
        throw "Missing required manifest property: $ObjectPath.$PropertyName"
    }

    return $property.Value
}

$resolvedManifestPath = [System.IO.Path]::GetFullPath($ManifestPath)
if (-not (Test-Path -LiteralPath $resolvedManifestPath -PathType Leaf)) {
    throw "M2 build manifest not found: $resolvedManifestPath"
}

$manifest = Get-Content -LiteralPath $resolvedManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$schemaVersion = Get-RequiredPropertyValue $manifest "schemaVersion" "manifest"
$purpose = Get-RequiredPropertyValue $manifest "purpose" "manifest"
if ($schemaVersion -ne 1 -or $purpose -ne "m2-playtest-target-build") {
    throw "Unsupported M2 build manifest version or purpose."
}

$source = Get-RequiredPropertyValue $manifest "source" "manifest"
$worktreeId = Get-RequiredPropertyValue $source "worktreeId" "manifest.source"
$artifacts = Get-RequiredPropertyValue $manifest "artifacts" "manifest"
$executable = Get-RequiredPropertyValue $artifacts "executable" "manifest.artifacts"
$executableRelativePath = Get-RequiredPropertyValue `
    $executable `
    "relativePath" `
    "manifest.artifacts.executable"
$executableHash = Get-RequiredPropertyValue `
    $executable `
    "sha256" `
    "manifest.artifacts.executable"
$performanceEvidence = Get-RequiredPropertyValue `
    $manifest `
    "performanceEvidence" `
    "manifest"
$reportRelativePath = Get-RequiredPropertyValue `
    $performanceEvidence `
    "relativePath" `
    "manifest.performanceEvidence"
$reportHash = Get-RequiredPropertyValue `
    $performanceEvidence `
    "sha256" `
    "manifest.performanceEvidence"

$repoPrefix = $repoRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) +
    [System.IO.Path]::DirectorySeparatorChar

function Resolve-RepositoryFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RelativePath,
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if ([System.IO.Path]::IsPathRooted($RelativePath)) {
        throw "$Label must use a repository-relative path."
    }

    $resolvedPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $RelativePath))
    if (-not $resolvedPath.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label must stay inside the repository."
    }
    if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
        throw "$Label not found: $resolvedPath"
    }

    return $resolvedPath
}

function Confirm-FileHash {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedHash,
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if ($ExpectedHash -notmatch "^[A-Fa-f0-9]{64}$") {
        throw "$Label has an invalid expected SHA-256 value."
    }

    $actualHash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($actualHash -ne $ExpectedHash.ToUpperInvariant()) {
        throw "$Label hash mismatch.`nExpected: $ExpectedHash`nActual: $actualHash`nFile: $Path"
    }

    return [PSCustomObject]@{
        Item = $Label
        Sha256 = $actualHash
        Path = $Path
    }
}

$artifactPath = Resolve-RepositoryFile `
    -RelativePath $executableRelativePath `
    -Label "Target executable"
$reportPath = Resolve-RepositoryFile `
    -RelativePath $reportRelativePath `
    -Label "Performance report"

$verified = @(
    Confirm-FileHash `
        -Path $artifactPath `
        -ExpectedHash $executableHash `
        -Label "Target executable"
    Confirm-FileHash `
        -Path $reportPath `
        -ExpectedHash $reportHash `
        -Label "Performance report"
)

Write-Host ""
Write-Host "M2 target build verification passed." -ForegroundColor Green
$verified | Format-Table -AutoSize
Write-Host "Build identity: $worktreeId"
Write-Host "Before each observation, use Help > Restart chapter > Confirm restart in the game."

if (-not $Launch) {
    Write-Host "To launch this exact build, run: pnpm m2:playtest"
    return
}

$runningProcesses = @(Get-Process -Name "dream-builder" -ErrorAction SilentlyContinue)
if ($runningProcesses.Count -gt 0) {
    $runningIds = ($runningProcesses.Id | Sort-Object) -join ", "
    throw "dream-builder is already running (PID: $runningIds). Close it manually before starting a fresh observation."
}

$launchedProcess = Start-Process `
    -FilePath $artifactPath `
    -WorkingDirectory (Split-Path -Parent $artifactPath) `
    -PassThru
Start-Sleep -Milliseconds 750
$launchedProcess.Refresh()
if ($launchedProcess.HasExited) {
    throw "dream-builder exited before the observation window was ready (exit code: $($launchedProcess.ExitCode))."
}
Write-Host "M2 target build launched (PID: $($launchedProcess.Id))." -ForegroundColor Green
