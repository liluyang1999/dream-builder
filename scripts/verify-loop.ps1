$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$loopDirectory = Join-Path $repositoryRoot "loop"

if (-not (Test-Path -LiteralPath $loopDirectory -PathType Container)) {
    throw "Loop Engineering directory is missing: $loopDirectory"
}

$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
function Read-Utf8Text {
    param([Parameter(Mandatory = $true)][string]$Path)
    return $utf8.GetString([IO.File]::ReadAllBytes($Path))
}

# ---------------------------------------------------------------------------
# Required structure. An agent picking up work must always find the entry
# point, the discipline, the current status, and the product contract.
# ---------------------------------------------------------------------------
$requiredFiles = [ordered]@{
    "README.md" = "Entry point and directory map"
    "concepts.md" = "Loop Engineering concepts and working discipline"
    "progress.md" = "Progress ledger: milestones, closed facts, open gates"
    "product/README.md" = "Vision, pillars, milestones, definition of done"
    "product/release-1.0.md" = "Scope and module acceptance matrix"
    "product/vertical-slice.md" = "Ten-minute experience and system contract"
    "product/m2-playtest.md" = "Unprompted playability observation protocol"
    "product/release-runbook.md" = "Windows build, sign, install, rollback"
    "evidence/README.md" = "Evidence archive rules"
    "evidence/m2-target-build.json" = "Target build and performance evidence manifest"
    "history/README.md" = "Historical design notes index"
}
foreach ($entry in $requiredFiles.GetEnumerator()) {
    $path = Join-Path $loopDirectory ($entry.Key.Replace('/', [IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Loop Engineering record is missing: loop/$($entry.Key) ($($entry.Value))"
    }
}

$requiredDirectories = @("product", "evidence", "history")
foreach ($directory in $requiredDirectories) {
    if (-not (Test-Path -LiteralPath (Join-Path $loopDirectory $directory) -PathType Container)) {
        throw "Loop Engineering subdirectory is missing: loop/$directory"
    }
}

# ---------------------------------------------------------------------------
# loop/ records engineering state; teaching material belongs in docs/.
# ---------------------------------------------------------------------------
$teachingPages = @(
    Get-ChildItem -LiteralPath $loopDirectory -Recurse -File -Filter "*.html" |
        ForEach-Object { $_.FullName.Substring($repositoryRoot.Length + 1).Replace('\', '/') }
)
if ($teachingPages.Count -gt 0) {
    throw "loop/ must not hold teaching pages (they belong in docs/); found: $($teachingPages -join ', ')"
}

# ---------------------------------------------------------------------------
# The entry point must route to every area, and must point at the teaching
# archive so the two directories stay connected in both directions.
# ---------------------------------------------------------------------------
$loopIndex = Read-Utf8Text (Join-Path $loopDirectory "README.md")
$requiredRoutes = @(
    "concepts.md"
    "progress.md"
    "product/README.md"
    "evidence/README.md"
    "history/README.md"
    "../docs/index.html"
)
foreach ($route in $requiredRoutes) {
    if ($loopIndex -notmatch [regex]::Escape("($route)")) {
        throw "loop/README.md must link to: $route"
    }
}

# The progress ledger must keep unmet human gates visible; an all-green
# engineering record with no open items is the failure mode this guards.
$progress = Read-Utf8Text (Join-Path $loopDirectory "progress.md")
foreach ($marker in @("未闭合", "外部门槛")) {
    if ($progress -notmatch [regex]::Escape($marker)) {
        throw "loop/progress.md must keep unmet external gates visible (missing: $marker)."
    }
}

# ---------------------------------------------------------------------------
# Every relative link in every record must resolve.
# ---------------------------------------------------------------------------
$markdownFiles = @(Get-ChildItem -LiteralPath $loopDirectory -Recurse -File -Filter "*.md")
$linkCount = 0
foreach ($markdownFile in $markdownFiles) {
    $markdown = Read-Utf8Text $markdownFile.FullName
    $relativeSource = $markdownFile.FullName.Substring($repositoryRoot.Length + 1).Replace('\', '/')
    $targets = @(
        [regex]::Matches($markdown, '\]\(([^)\s]+)(?:\s+"[^"]*")?\)') | ForEach-Object { $_.Groups[1].Value }
    )
    foreach ($target in $targets) {
        if ($target.StartsWith("#") -or $target -match '^(?i)(https?://|mailto:)') { continue }
        $linkCount++
        $localPath = ($target -split '#', 2)[0]
        if ([string]::IsNullOrWhiteSpace($localPath)) { continue }
        $decodedPath = [Uri]::UnescapeDataString($localPath).Replace('/', [IO.Path]::DirectorySeparatorChar)
        $resolvedPath = [IO.Path]::GetFullPath((Join-Path $markdownFile.DirectoryName $decodedPath))
        if (-not $resolvedPath.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Loop record link escapes the repository: $relativeSource -> $target"
        }
        if (-not (Test-Path -LiteralPath $resolvedPath)) {
            throw "Loop record links to a missing local path: $relativeSource -> $target"
        }
    }
}

# ---------------------------------------------------------------------------
# Evidence pointers must resolve. Hashes are checked by m2:verify; here we only
# guarantee the manifest still points at a file that exists.
# ---------------------------------------------------------------------------
$manifestPath = Join-Path $loopDirectory "evidence\m2-target-build.json"
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$reportRelativePath = [string]$manifest.performanceEvidence.relativePath
if ([string]::IsNullOrWhiteSpace($reportRelativePath)) {
    throw "loop/evidence/m2-target-build.json does not declare performanceEvidence.relativePath."
}
$reportPath = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $reportRelativePath))
if (-not $reportPath.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Evidence pointer escapes the repository: $reportRelativePath"
}
if (-not (Test-Path -LiteralPath $reportPath -PathType Leaf)) {
    throw "Evidence manifest points at a missing report: $reportRelativePath"
}

$evidenceFiles = @(Get-ChildItem -LiteralPath (Join-Path $loopDirectory "evidence") -File)

Write-Host "Loop Engineering records verified:" -ForegroundColor Green
[pscustomobject]@{
    Directory = $loopDirectory
    Records = $markdownFiles.Count
    EvidenceFiles = $evidenceFiles.Count
    Links = $linkCount
    EvidencePointer = $reportRelativePath
} | Format-List
