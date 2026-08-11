$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$docsDirectory = Join-Path $repositoryRoot "docs"
$archivePath = Join-Path $docsDirectory "index.html"

if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    throw "Teaching archive is missing: $archivePath"
}

$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
$html = $utf8.GetString([IO.File]::ReadAllBytes($archivePath))

$requiredPatterns = [ordered]@{
    "HTML5 doctype" = '(?i)^\s*<!doctype html>'
    "Chinese document language" = '(?i)<html\s+lang="zh-CN"'
    "UTF-8 declaration" = '(?i)<meta\s+charset="utf-8"'
    "Responsive viewport" = '(?i)<meta\s+name="viewport"'
    "Product architecture" = 'id="architecture"'
    "Monorepo layout" = 'id="repository"'
    "End-to-end runtime flow" = 'id="runtime-flow"'
    "TypeScript and React" = 'id="typescript-react"'
    "State and persistence" = 'id="state-persistence"'
    "3D rendering" = 'id="graphics"'
    "Accessibility and input" = 'id="accessibility-input"'
    "Performance evidence" = 'id="performance"'
    "IPC boundary" = 'id="ipc"'
    "Rust backend" = 'id="rust"'
    "Tauri framework" = 'id="tauri"'
    "WebView2 strategy" = 'id="webview2"'
    "Security boundaries" = 'id="security"'
    "Build toolchain" = 'id="build-toolchain"'
    "Versioning" = 'id="version-dependencies"'
    "Quality gates" = 'id="quality"'
    "Continuous integration" = 'id="continuous-integration"'
    "Release operations" = 'id="release"'
    "Source map" = 'id="code-map"'
    "Learning path" = 'id="learning-path"'
    "Glossary" = 'id="glossary"'
    "Public version" = 'output/release/1\.0'
    "Windows display version" = 'DisplayVersion'
    "Evergreen runtime" = 'WebView2 Evergreen'
    "Project-local pnpm store" = '\.pnpm-store/'
    "Project-local pnpm cache" = '\.pnpm-cache/'
}
foreach ($entry in $requiredPatterns.GetEnumerator()) {
    if ($html -notmatch $entry.Value) {
        throw "Teaching archive is missing required coverage: $($entry.Key)."
    }
}

if ($html -match '(?i)\b(TODO|TBD|FIXME)\b') {
    throw "Teaching archive contains an unfinished placeholder."
}
if ($html -match '(?i)technicalVersion' -or $html -match '(?<![0-9.])1\.0\.0(?![0-9.])') {
    throw "Teaching archive must expose only the two-component product version."
}
if ($html -match '(?i)<(?:script|link)\b[^>]*(?:src|href)="https?://') {
    throw "Teaching archive must not depend on remote scripts or stylesheets."
}

$ids = @(
    [regex]::Matches($html, '\sid="([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value }
)
$duplicateIds = @($ids | Group-Object | Where-Object Count -gt 1)
if ($duplicateIds.Count -gt 0) {
    throw "Teaching archive contains duplicate ids: $($duplicateIds.Name -join ', ')"
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
            throw "Teaching archive links to a missing anchor: $href"
        }
        continue
    }
    if ($href -match '^(?i)(https?://|mailto:)') {
        continue
    }

    $localPath = ($href -split '[?#]', 2)[0]
    $decodedPath = [Uri]::UnescapeDataString($localPath).Replace('/', [IO.Path]::DirectorySeparatorChar)
    $resolvedPath = [IO.Path]::GetFullPath((Join-Path $docsDirectory $decodedPath))
    if (-not $resolvedPath.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Teaching archive link escapes the repository: $href"
    }
    if (-not (Test-Path -LiteralPath $resolvedPath)) {
        throw "Teaching archive links to a missing local path: $href"
    }
}

# Every section must be reachable from the sidebar table of contents, otherwise a
# newly added topic silently drops out of the reading order.
$sectionIds = @(
    [regex]::Matches($html, '(?i)<section\s+id="([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value }
)
$fragmentTargets = @{}
foreach ($href in $hrefs) {
    if ($href.StartsWith("#")) {
        $fragmentTargets[$href.Substring(1)] = $true
    }
}
$unreachableSections = @($sectionIds | Where-Object { -not $fragmentTargets.ContainsKey($_) })
if ($unreachableSections.Count -gt 0) {
    throw "Teaching archive sections are not linked from any navigation: $($unreachableSections -join ', ')"
}

# Sibling documentation under docs/ must stay discoverable from the archive so the
# directory keeps a single entry point.
$siblingDocuments = @(
    "README.md"
    "game/README.md"
    "game/vertical-slice.md"
    "game/release-runbook.md"
    "design/README.md"
)
foreach ($document in $siblingDocuments) {
    if (-not (Test-Path -LiteralPath (Join-Path $docsDirectory $document.Replace('/', [IO.Path]::DirectorySeparatorChar)))) {
        throw "Expected sibling documentation is missing: docs/$document"
    }
    if ($html -notmatch [regex]::Escape("href=""./$document""")) {
        throw "Teaching archive must link to sibling documentation: docs/$document"
    }
}

# The archive claims to map every module. Enumerate the real source tree and
# require each file's repository-relative path to appear, so a new module cannot
# be added without a line explaining what it does.
$sourceRoots = @(
    "apps\desktop\src"
    "packages\ipc-contracts\src"
    "packages\liquid-glass\src"
    "crates\dream-builder\src"
)
$undocumentedModules = [System.Collections.Generic.List[string]]::new()
$documentedModuleCount = 0
foreach ($sourceRoot in $sourceRoots) {
    $absoluteRoot = Join-Path $repositoryRoot $sourceRoot
    if (-not (Test-Path -LiteralPath $absoluteRoot -PathType Container)) {
        throw "Expected source root is missing: $sourceRoot"
    }
    $sourceFiles = @(
        Get-ChildItem -LiteralPath $absoluteRoot -Recurse -File |
            Where-Object {
                $_.Extension -in @(".ts", ".tsx", ".rs") -and
                $_.Name -notlike "*.test.*" -and
                $_.Name -notlike "*.d.ts" -and
                $_.FullName -notmatch '\\tests\\'
            }
    )
    foreach ($sourceFile in $sourceFiles) {
        $relativePath = $sourceFile.FullName.Substring($repositoryRoot.Length + 1).Replace('\', '/')
        if ($html.Contains($relativePath)) {
            $documentedModuleCount++
        }
        else {
            $undocumentedModules.Add($relativePath)
        }
    }
}
if ($undocumentedModules.Count -gt 0) {
    throw "Teaching archive does not document these source modules: $($undocumentedModules -join ', ')"
}

# Every Markdown file under docs/ is part of the same directory contract, so its
# relative links must resolve too — a broken product-doc link is just as bad as a
# broken archive link.
$markdownFiles = @(Get-ChildItem -LiteralPath $docsDirectory -Recurse -File -Filter "*.md")
$markdownLinkCount = 0
foreach ($markdownFile in $markdownFiles) {
    $markdown = Get-Content -LiteralPath $markdownFile.FullName -Raw -Encoding UTF8
    $targets = @(
        [regex]::Matches($markdown, '\]\(([^)\s]+)(?:\s+"[^"]*")?\)') |
            ForEach-Object { $_.Groups[1].Value }
    )
    foreach ($target in $targets) {
        if ($target.StartsWith("#") -or $target -match '^(?i)(https?://|mailto:)') {
            continue
        }
        $markdownLinkCount++
        $localPath = ($target -split '#', 2)[0]
        if ([string]::IsNullOrWhiteSpace($localPath)) {
            continue
        }
        $decodedPath = [Uri]::UnescapeDataString($localPath).Replace('/', [IO.Path]::DirectorySeparatorChar)
        $resolvedPath = [IO.Path]::GetFullPath((Join-Path $markdownFile.DirectoryName $decodedPath))
        if (-not $resolvedPath.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            $relativeSource = $markdownFile.FullName.Substring($repositoryRoot.Length + 1).Replace('\', '/')
            throw "Documentation link escapes the repository: $relativeSource -> $target"
        }
        if (-not (Test-Path -LiteralPath $resolvedPath)) {
            $relativeSource = $markdownFile.FullName.Substring($repositoryRoot.Length + 1).Replace('\', '/')
            throw "Documentation links to a missing local path: $relativeSource -> $target"
        }
    }
}

$topicCount = $sectionIds.Count
$textLength = (($html -replace '<[^>]+>', ' ') -replace '\s+', ' ').Trim().Length
if ($topicCount -lt 20 -or $textLength -lt 26000) {
    throw "Teaching archive is not comprehensive enough (sections=$topicCount, characters=$textLength)."
}

Write-Host "Documentation verified:" -ForegroundColor Green
[pscustomobject]@{
    File = $archivePath
    Sections = $topicCount
    TextCharacters = $textLength
    Anchors = $ids.Count
    Links = $hrefs.Count
    DocumentedModules = $documentedModuleCount
    MarkdownFiles = $markdownFiles.Count
    MarkdownLinks = $markdownLinkCount
} | Format-List
