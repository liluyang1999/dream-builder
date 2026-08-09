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

Write-Host "Project contracts verified:" -ForegroundColor Green
[pscustomobject]@{
    ProductVersion = $versionContract.ProductVersion
    TechnicalVersion = $versionContract.TechnicalVersion
    WebView2 = "Evergreen (downloadBootstrapper, unpinned)"
} | Format-List
