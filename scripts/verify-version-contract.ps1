$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $PSScriptRoot "lib\version-contract.ps1")

$versionContract = Get-DreamBuilderVersionContract -RepositoryRoot $repositoryRoot
$windowsBundle = $versionContract.TauriConfig.bundle.windows
$webviewMode = $windowsBundle.webviewInstallMode

if ([string]$webviewMode.type -ne "downloadBootstrapper" -or -not [bool]$webviewMode.silent) {
    throw "Windows bundles must use the silent WebView2 Evergreen bootstrapper."
}
if ($null -ne $webviewMode.PSObject.Properties["path"]) {
    throw "Windows bundles must not pin or embed a fixed WebView2 runtime path."
}

$publicDisplayFiles = @(
    Get-Item -LiteralPath (Join-Path $repositoryRoot "README.md")
    Get-Item -LiteralPath (Join-Path $repositoryRoot "CHANGELOG.md")
    Get-Item -LiteralPath (Join-Path $repositoryRoot "AGENTS.md")
    Get-Item -LiteralPath (Join-Path $repositoryRoot "crates\dream-builder\installer\LICENSE.txt")
    Get-ChildItem -LiteralPath (Join-Path $repositoryRoot "docs") -Recurse -File |
        Where-Object { $_.Extension -in @(".md", ".html", ".txt") }
)
$forbiddenPublicVersion = [regex]::Escape($versionContract.ToolingVersion)
$forbiddenPublicPatterns = @(
    "(?<![0-9.])$forbiddenPublicVersion(?![0-9.])",
    '(?i)\b(?:technicalVersion|binaryProductVersion)\b',
    '(?i)(?:产品版本|应用版本|公开版本|技术版本|DisplayVersion|ProductVersion|FileVersion)[^\r\n0-9]{0,24}[0-9]+\.[0-9]+\.[0-9]+',
    '(?i)(?:output[\\/]+release[\\/]+|Dream-Builder-Fantasy-Tree_|Dream Builder Fantasy Tree_)[0-9]+\.[0-9]+\.[0-9]+'
)
foreach ($file in $publicDisplayFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    foreach ($pattern in $forbiddenPublicPatterns) {
        if ($content -match $pattern) {
            throw "Public material must show only '$($versionContract.ProductVersion)': $($file.FullName)"
        }
    }
}

Write-Host "Project contracts verified:" -ForegroundColor Green
[pscustomobject]@{
    Version = $versionContract.ProductVersion
    WindowsDisplayVersion = $versionContract.InstallerDisplayVersion
    ToolingCompatibility = "verified (not player-visible)"
    TauriCli = "$($versionContract.TauriCliVersion) (exact template match)"
    WebView2 = "Evergreen (downloadBootstrapper, unpinned)"
} | Format-List
