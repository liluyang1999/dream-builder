[CmdletBinding()]
param(
    [string]$ManifestPath = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
    $ManifestPath = Join-Path $repoRoot "docs\game\evidence\m2-target-build.json"
}

$resolvedManifestPath = [System.IO.Path]::GetFullPath($ManifestPath)
if (-not (Test-Path -LiteralPath $resolvedManifestPath -PathType Leaf)) {
    throw "M2 evidence manifest not found: $resolvedManifestPath"
}
$manifest = Get-Content -LiteralPath $resolvedManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([int]$manifest.schemaVersion -ne 2 -or [string]$manifest.purpose -ne "m2-performance-evidence-archive") {
    throw "Unsupported M2 evidence manifest version or purpose."
}
if ([string]$manifest.artifacts.availability -ne "identity-only") {
    throw "Archived M2 executable identities must not imply that binaries are vendored."
}

foreach ($artifactName in @("executable", "installer")) {
    $artifact = $manifest.artifacts.PSObject.Properties[$artifactName].Value
    if ($null -ne $artifact.PSObject.Properties["relativePath"]) {
        throw "Archived $artifactName identity must not point at a mutable current binary."
    }
    if ([string]$artifact.sha256 -notmatch '^[A-Fa-f0-9]{64}$') {
        throw "Archived $artifactName identity has an invalid SHA-256 value."
    }
    if ([long]$artifact.sizeBytes -le 0) {
        throw "Archived $artifactName identity must retain its measured byte size."
    }
    $builtAtUtc = [DateTime]::MinValue
    if (-not [DateTime]::TryParse(
        [string]$artifact.builtAtUtc,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::AdjustToUniversal,
        [ref]$builtAtUtc
    )) {
        throw "Archived $artifactName identity has an invalid build timestamp."
    }
}

$reportRelativePath = [string]$manifest.performanceEvidence.relativePath
if ([System.IO.Path]::IsPathRooted($reportRelativePath)) {
    throw "The M2 performance report path must be repository-relative."
}
$reportPath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $reportRelativePath))
$repoPrefix = $repoRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) +
    [System.IO.Path]::DirectorySeparatorChar
if (-not $reportPath.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The M2 performance report must stay inside the repository."
}
if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) {
    throw "M2 performance report not found: $reportPath"
}

$expectedReportHash = [string]$manifest.performanceEvidence.sha256
if ($expectedReportHash -notmatch '^[A-Fa-f0-9]{64}$') {
    throw "The M2 performance report has an invalid expected SHA-256 value."
}
$actualReportHash = (Get-FileHash -LiteralPath $reportPath -Algorithm SHA256).Hash.ToUpperInvariant()
if ($actualReportHash -ne $expectedReportHash.ToUpperInvariant()) {
    throw "Performance report hash mismatch.`nExpected: $expectedReportHash`nActual: $actualReportHash`nFile: $reportPath"
}

$report = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not [bool]$report.completedTargetDuration -or [double]$report.durationMs -lt 600000) {
    throw "The archived M2 report does not contain a completed ten-minute capture."
}
if ([string]$report.context.runtime -ne "tauri" -or [string]$report.context.source -ne "rust") {
    throw "The archived M2 report must come from the native Tauri/Rust path."
}
$phaseNames = @($report.phases | ForEach-Object { [string]$_.name })
foreach ($requiredPhase in @("scene-load", "cleansing")) {
    if ($requiredPhase -notin $phaseNames) {
        throw "The archived M2 report is missing the required '$requiredPhase' phase."
    }
}

$frameCount = [double]$report.session.frameCount
$slowFrameRatio = if ($frameCount -gt 0) {
    [double]$report.session.framesOver50Ms / $frameCount
} else {
    [double]::PositiveInfinity
}
if (
    [double]$report.session.averageFps -lt 55 -or
    [double]$report.session.onePercentLowFps -lt 30 -or
    $slowFrameRatio -gt 0.01
) {
    throw "The archived M2 report no longer satisfies the documented performance budget."
}

Write-Host ""
Write-Host "M2 performance evidence verification passed." -ForegroundColor Green
[pscustomobject]@{
    Report = $reportRelativePath
    Sha256 = $actualReportHash
    DurationMs = [double]$report.durationMs
    AverageFps = [double]$report.session.averageFps
    OnePercentLowFps = [double]$report.session.onePercentLowFps
    FramesOver50Ms = "$( [int]$report.session.framesOver50Ms ) / $( [int]$report.session.frameCount )"
    RequiredPhases = ($phaseNames -join ", ")
    CapturedBuild = [string]$manifest.source.worktreeId
} | Format-List
Write-Host "Executable hashes are retained as historical identity only; no obsolete binary is launched."
