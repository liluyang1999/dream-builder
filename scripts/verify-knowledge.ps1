$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$knowledgeDirectory = Join-Path $repositoryRoot "knowledge"
$archivePath = Join-Path $knowledgeDirectory "index.html"

if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    throw "Knowledge archive is missing: $archivePath"
}

$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
$html = $utf8.GetString([IO.File]::ReadAllBytes($archivePath))

$requiredPatterns = [ordered]@{
    "HTML5 doctype" = '(?i)^\s*<!doctype html>'
    "Chinese document language" = '(?i)<html\s+lang="zh-CN"'
    "UTF-8 declaration" = '(?i)<meta\s+charset="utf-8"'
    "Responsive viewport" = '(?i)<meta\s+name="viewport"'
    "Product architecture" = 'id="architecture"'
    "TypeScript and React" = 'id="typescript-react"'
    "Rust backend" = 'id="rust"'
    "Tauri framework" = 'id="tauri"'
    "WebView2 strategy" = 'id="webview2"'
    "IPC boundary" = 'id="ipc"'
    "3D rendering" = 'id="graphics"'
    "State and persistence" = 'id="state-persistence"'
    "Quality gates" = 'id="quality"'
    "Release operations" = 'id="release"'
    "Glossary" = 'id="glossary"'
    "Public version" = 'output/release/1\.1'
    "Technical version" = 'technicalVersion: 1\.1\.0'
    "Evergreen runtime" = 'WebView2 Evergreen'
    "Project-local pnpm store" = '\.pnpm-store/'
    "Project-local pnpm cache" = '\.pnpm-cache/'
}
foreach ($entry in $requiredPatterns.GetEnumerator()) {
    if ($html -notmatch $entry.Value) {
        throw "Knowledge archive is missing required coverage: $($entry.Key)."
    }
}

if ($html -match '(?i)\b(TODO|TBD|FIXME)\b') {
    throw "Knowledge archive contains an unfinished placeholder."
}
if ($html -match '(?i)<(?:script|link)\b[^>]*(?:src|href)="https?://') {
    throw "Knowledge archive must not depend on remote scripts or stylesheets."
}

$ids = @(
    [regex]::Matches($html, '\sid="([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value }
)
$duplicateIds = @($ids | Group-Object | Where-Object Count -gt 1)
if ($duplicateIds.Count -gt 0) {
    throw "Knowledge archive contains duplicate ids: $($duplicateIds.Name -join ', ')"
}
$idSet = @{}
foreach ($id in $ids) {
    $idSet[$id] = $true
}

$hrefs = @(
    [regex]::Matches($html, '(?i)<a\b[^>]*\shref="([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value }
)
foreach ($href in $hrefs) {
    if ($href.StartsWith("#")) {
        $fragment = $href.Substring(1)
        if (-not [string]::IsNullOrWhiteSpace($fragment) -and -not $idSet.ContainsKey($fragment)) {
            throw "Knowledge archive links to a missing anchor: $href"
        }
        continue
    }
    if ($href -match '^(?i)(https?://|mailto:)') {
        continue
    }

    $localPath = ($href -split '[?#]', 2)[0]
    $decodedPath = [Uri]::UnescapeDataString($localPath).Replace('/', [IO.Path]::DirectorySeparatorChar)
    $resolvedPath = [IO.Path]::GetFullPath((Join-Path $knowledgeDirectory $decodedPath))
    if (-not $resolvedPath.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Knowledge archive link escapes the repository: $href"
    }
    if (-not (Test-Path -LiteralPath $resolvedPath)) {
        throw "Knowledge archive links to a missing local path: $href"
    }
}

$topicCount = [regex]::Matches($html, '<section\b').Count
$textLength = (($html -replace '<[^>]+>', ' ') -replace '\s+', ' ').Trim().Length
if ($topicCount -lt 12 -or $textLength -lt 20000) {
    throw "Knowledge archive is not comprehensive enough (sections=$topicCount, characters=$textLength)."
}

Write-Host "Knowledge archive verified:" -ForegroundColor Green
[pscustomobject]@{
    File = $archivePath
    Sections = $topicCount
    TextCharacters = $textLength
    Anchors = $ids.Count
    Links = $hrefs.Count
} | Format-List
