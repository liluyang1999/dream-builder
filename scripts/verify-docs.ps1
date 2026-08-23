$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$docsDirectory = Join-Path $repositoryRoot "docs"
$hubPath = Join-Path $docsDirectory "index.html"
$stylesheetPath = Join-Path $docsDirectory "assets\learn.css"
$indexPath = Join-Path $docsDirectory "README.md"

if (-not (Test-Path -LiteralPath $docsDirectory -PathType Container)) {
    throw "Teaching directory is missing: $docsDirectory"
}
foreach ($required in @($hubPath, $stylesheetPath, $indexPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Required teaching file is missing: $required"
    }
}

$utf8 = New-Object System.Text.UTF8Encoding($false, $true)
function Read-Utf8Text {
    param([Parameter(Mandatory = $true)][string]$Path)
    return $utf8.GetString([IO.File]::ReadAllBytes($Path))
}

# ---------------------------------------------------------------------------
# Every topic the archive must keep teaching. Deleting a page is a deliberate
# product decision, not something a refactor should be able to do silently.
# ---------------------------------------------------------------------------
$requiredPages = [ordered]@{
    "index.html" = "Hub and learning path"
    "overview.html" = "Product snapshot, architecture, monorepo, runtime flow"
    "frontend.html" = "TypeScript, React, state and persistence"
    "graphics.html" = "Three.js, react-three-fiber, audio"
    "accessibility.html" = "Accessibility and input devices"
    "performance.html" = "Performance evidence"
    "ipc.html" = "IPC contract and Worker boundary"
    "rust.html" = "Rust backend"
    "tauri.html" = "Tauri and WebView2"
    "security.html" = "Security boundaries"
    "build.html" = "Build toolchain and versioning"
    "quality.html" = "Quality gates and continuous integration"
    "release.html" = "Windows release"
    "code-map.html" = "Complete source module index"
    "glossary.html" = "Glossary"
}
foreach ($entry in $requiredPages.GetEnumerator()) {
    if (-not (Test-Path -LiteralPath (Join-Path $docsDirectory $entry.Key) -PathType Leaf)) {
        throw "Teaching archive is missing a required page: docs/$($entry.Key) ($($entry.Value))"
    }
}

$pageFiles = @(Get-ChildItem -LiteralPath $docsDirectory -File -Filter "*.html" | Sort-Object Name)
$pages = @{}
foreach ($pageFile in $pageFiles) {
    $pages[$pageFile.Name] = Read-Utf8Text $pageFile.FullName
}

# ---------------------------------------------------------------------------
# Per-page structure, offline self-containment, and honesty checks.
# ---------------------------------------------------------------------------
$structurePatterns = [ordered]@{
    "HTML5 doctype" = '(?i)^\s*<!doctype html>'
    "Chinese document language" = '(?i)<html\s+lang="zh-CN"'
    "UTF-8 declaration" = '(?i)<meta\s+charset="utf-8"'
    "Responsive viewport" = '(?i)<meta\s+name="viewport"'
    "Page description" = '(?i)<meta\s+name="description"\s+content="[^"]{10,}"'
    "Document title" = '(?i)<title>[^<]{6,}</title>'
    "Shared stylesheet" = '(?i)<link\s+rel="stylesheet"\s+href="\./assets/learn\.css"'
    "Skip link" = '(?i)<a\s+class="skip-link"\s+href="#main-content"'
    "Main landmark" = '(?i)<main\s+id="main-content">'
    "Sidebar navigation" = '(?i)<aside\s+class="toc"'
}
foreach ($pageName in $pages.Keys) {
    $pageHtml = $pages[$pageName]
    foreach ($entry in $structurePatterns.GetEnumerator()) {
        if ($pageHtml -notmatch $entry.Value) {
            throw "docs/${pageName}: missing required structure ($($entry.Key))."
        }
    }
    if ($pageHtml -match '(?i)\b(TODO|TBD|FIXME)\b') {
        throw "docs/${pageName}: contains an unfinished placeholder."
    }
    if ($pageHtml -match '(?i)technicalVersion' -or $pageHtml -match '(?<![0-9.])1\.0\.0(?![0-9.])') {
        throw "docs/${pageName}: must expose only the two-component product version."
    }
    if ($pageHtml -match '(?i)<(?:script|link|img)\b[^>]*(?:src|href)="https?://') {
        throw "docs/${pageName}: must not depend on remote scripts, stylesheets, or images."
    }
    if ($pageHtml -match '(?i)<style\b') {
        throw "docs/${pageName}: styles belong in the shared assets/learn.css, not inline."
    }
}

# ---------------------------------------------------------------------------
# Anchors and links, per page.
# ---------------------------------------------------------------------------
$totalAnchors = 0
$totalLinks = 0
$allSectionIds = [System.Collections.Generic.HashSet[string]]::new()
foreach ($pageName in $pages.Keys) {
    $pageHtml = $pages[$pageName]

    $ids = @(
        [regex]::Matches($pageHtml, '\sid="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
    )
    $duplicateIds = @($ids | Group-Object | Where-Object Count -gt 1)
    if ($duplicateIds.Count -gt 0) {
        throw "docs/${pageName}: duplicate ids: $($duplicateIds.Name -join ', ')"
    }
    $idSet = @{}
    foreach ($id in $ids) { $idSet[$id] = $true }
    $totalAnchors += $ids.Count

    foreach ($sectionId in [regex]::Matches($pageHtml, '(?i)<section\s+id="([^"]+)"')) {
        [void]$allSectionIds.Add($sectionId.Groups[1].Value)
    }

    $hrefs = @(
        [regex]::Matches($pageHtml, '(?i)<a\b[^>]*\shref="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
    )
    $totalLinks += $hrefs.Count
    foreach ($href in $hrefs) {
        if ($href.StartsWith("#")) {
            $fragment = $href.Substring(1)
            if (-not [string]::IsNullOrWhiteSpace($fragment) -and -not $idSet.ContainsKey($fragment)) {
                throw "docs/${pageName}: links to a missing anchor: $href"
            }
            continue
        }
        if ($href -match '^(?i)(https?://|mailto:)') { continue }

        $localPath = ($href -split '[?#]', 2)[0]
        if ([string]::IsNullOrWhiteSpace($localPath)) { continue }
        $decodedPath = [Uri]::UnescapeDataString($localPath).Replace('/', [IO.Path]::DirectorySeparatorChar)
        $resolvedPath = [IO.Path]::GetFullPath((Join-Path $docsDirectory $decodedPath))
        if (-not $resolvedPath.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw "docs/${pageName}: link escapes the repository: $href"
        }
        if (-not (Test-Path -LiteralPath $resolvedPath)) {
            throw "docs/${pageName}: links to a missing local path: $href"
        }

        $anchorPart = if ($href.Contains('#')) { ($href -split '#', 2)[1] } else { '' }
        if (-not [string]::IsNullOrWhiteSpace($anchorPart)) {
            $targetName = [IO.Path]::GetFileName($resolvedPath)
            if ($pages.ContainsKey($targetName) -and $pages[$targetName] -notmatch [regex]::Escape(" id=""$anchorPart""")) {
                throw "docs/${pageName}: links to a missing anchor on another page: $href"
            }
        }
    }
}

# ---------------------------------------------------------------------------
# Navigation: every page reachable from the hub and present in every sidebar.
# ---------------------------------------------------------------------------
$hubHtml = $pages["index.html"]
foreach ($pageName in $pages.Keys) {
    if ($pageName -eq "index.html") { continue }
    if ($hubHtml -notmatch [regex]::Escape("href=""./$pageName""")) {
        throw "docs/${pageName} is not reachable from the hub (docs/index.html)."
    }
    if ($pages[$pageName] -notmatch [regex]::Escape('href="./index.html"')) {
        throw "docs/${pageName}: does not link back to the hub."
    }
}
foreach ($pageName in $pages.Keys) {
    $sidebarPages = @(
        [regex]::Matches($pages[$pageName], '(?is)<aside class="toc".*?</aside>') |
            ForEach-Object { [regex]::Matches($_.Value, 'href="\./([^"]+)"') } |
            ForEach-Object { $_.Groups[1].Value }
    )
    $missingFromSidebar = @($requiredPages.Keys | Where-Object { $sidebarPages -notcontains $_ })
    if ($missingFromSidebar.Count -gt 0) {
        throw "docs/${pageName}: sidebar omits $($missingFromSidebar -join ', ')"
    }
}

# ---------------------------------------------------------------------------
# Topic coverage across the whole site.
# ---------------------------------------------------------------------------
$combinedHtml = ($pages.Values -join "`n")
$requiredTopics = [ordered]@{
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
foreach ($entry in $requiredTopics.GetEnumerator()) {
    if ($combinedHtml -notmatch $entry.Value) {
        throw "Teaching archive is missing required coverage: $($entry.Key)."
    }
}

# The engineering loop stays reachable from the teaching archive, and the
# teaching index stays reachable from the pages.
$requiredOutboundLinks = @("./README.md", "../loop/README.md", "../loop/product/README.md")
foreach ($link in $requiredOutboundLinks) {
    if ($combinedHtml -notmatch [regex]::Escape("href=""$link""")) {
        throw "Teaching archive must link to: $link"
    }
}

# ---------------------------------------------------------------------------
# The archive claims to map every module. Enumerate the real source tree.
# ---------------------------------------------------------------------------
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
        if ($combinedHtml.Contains($relativePath)) {
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

# ---------------------------------------------------------------------------
# The teaching index is the GitHub-facing entry point; its links must resolve
# and it must list every page.
# ---------------------------------------------------------------------------
$markdownFiles = @(Get-ChildItem -LiteralPath $docsDirectory -Recurse -File -Filter "*.md")
$markdownLinkCount = 0
foreach ($markdownFile in $markdownFiles) {
    $markdown = Read-Utf8Text $markdownFile.FullName
    $relativeSource = $markdownFile.FullName.Substring($repositoryRoot.Length + 1).Replace('\', '/')
    $targets = @(
        [regex]::Matches($markdown, '\]\(([^)\s]+)(?:\s+"[^"]*")?\)') | ForEach-Object { $_.Groups[1].Value }
    )
    foreach ($target in $targets) {
        if ($target.StartsWith("#") -or $target -match '^(?i)(https?://|mailto:)') { continue }
        $markdownLinkCount++
        $localPath = ($target -split '#', 2)[0]
        if ([string]::IsNullOrWhiteSpace($localPath)) { continue }
        $decodedPath = [Uri]::UnescapeDataString($localPath).Replace('/', [IO.Path]::DirectorySeparatorChar)
        $resolvedPath = [IO.Path]::GetFullPath((Join-Path $markdownFile.DirectoryName $decodedPath))
        if (-not $resolvedPath.StartsWith($repositoryRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Teaching index link escapes the repository: $relativeSource -> $target"
        }
        if (-not (Test-Path -LiteralPath $resolvedPath)) {
            throw "Teaching index links to a missing local path: $relativeSource -> $target"
        }
    }
}
$indexMarkdown = Read-Utf8Text $indexPath
foreach ($pageName in $requiredPages.Keys) {
    if ($indexMarkdown -notmatch [regex]::Escape("($pageName)")) {
        throw "docs/README.md does not list the page: $pageName"
    }
}

# ---------------------------------------------------------------------------
# docs/ holds teaching material only: HTML pages, the index, and shared assets.
# Engineering records belong in loop/.
# ---------------------------------------------------------------------------
$strayRootFiles = @(
    Get-ChildItem -LiteralPath $docsDirectory -File |
        Where-Object { $_.Name -ne "README.md" -and $_.Extension -ne ".html" } |
        ForEach-Object { $_.Name }
)
if ($strayRootFiles.Count -gt 0) {
    throw "docs/ must contain only README.md and teaching pages; found: $($strayRootFiles -join ', ')"
}
$strayDirectories = @(
    Get-ChildItem -LiteralPath $docsDirectory -Directory |
        Where-Object { $_.Name -ne "assets" } |
        ForEach-Object { $_.Name }
)
if ($strayDirectories.Count -gt 0) {
    throw "docs/ must not hold non-teaching subdirectories (engineering records belong in loop/); found: $($strayDirectories -join ', ')"
}

$textLength = (($combinedHtml -replace '<[^>]+>', ' ') -replace '\s+', ' ').Trim().Length
if ($pages.Count -lt 15 -or $allSectionIds.Count -lt 20 -or $textLength -lt 30000) {
    throw "Teaching archive is not comprehensive enough (pages=$($pages.Count), sections=$($allSectionIds.Count), characters=$textLength)."
}

Write-Host "Teaching archive verified:" -ForegroundColor Green
[pscustomobject]@{
    Directory = $docsDirectory
    Pages = $pages.Count
    Sections = $allSectionIds.Count
    TextCharacters = $textLength
    Anchors = $totalAnchors
    Links = $totalLinks
    DocumentedModules = $documentedModuleCount
    IndexLinks = $markdownLinkCount
} | Format-List
