[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))

function Invoke-PnpmText {
    param(
        [Parameter(Mandatory = $true)]
        [string[]] $Arguments
    )

    $output = & pnpm @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "pnpm $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
    }

    return (($output | Out-String).Trim())
}

function Resolve-RepositoryPath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Value,

        [Parameter(Mandatory = $true)]
        [string] $Setting
    )

    if ([string]::IsNullOrWhiteSpace($Value) -or $Value -eq "undefined") {
        throw "pnpm setting '$Setting' must be explicitly configured."
    }

    if ([System.IO.Path]::IsPathRooted($Value)) {
        return [System.IO.Path]::GetFullPath($Value)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $Value))
}

function Assert-ExactPath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Actual,

        [Parameter(Mandatory = $true)]
        [string] $Expected,

        [Parameter(Mandatory = $true)]
        [string] $Label
    )

    if (-not [string]::Equals($Actual, $Expected, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label must resolve to '$Expected', but resolved to '$Actual'."
    }
}

function Assert-WithinPath {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Candidate,

        [Parameter(Mandatory = $true)]
        [string] $Parent,

        [Parameter(Mandatory = $true)]
        [string] $Label
    )

    $parentPrefix = $Parent.TrimEnd([char[]] @('\', '/')) + [System.IO.Path]::DirectorySeparatorChar
    $isParent = [string]::Equals($Candidate, $Parent, [StringComparison]::OrdinalIgnoreCase)
    $isDescendant = $Candidate.StartsWith($parentPrefix, [StringComparison]::OrdinalIgnoreCase)

    if (-not ($isParent -or $isDescendant)) {
        throw "$Label must stay below '$Parent', but resolved to '$Candidate'."
    }
}

$storeSetting = Invoke-PnpmText -Arguments @("config", "get", "store-dir")
$cacheSetting = Invoke-PnpmText -Arguments @("config", "get", "cache-dir")
$virtualStoreSetting = Invoke-PnpmText -Arguments @("config", "get", "virtual-store-dir")
$globalVirtualStore = Invoke-PnpmText -Arguments @("config", "get", "enable-global-virtual-store")
$resolvedStorePath = [System.IO.Path]::GetFullPath((Invoke-PnpmText -Arguments @("store", "path")))

$configuredStorePath = Resolve-RepositoryPath -Value $storeSetting -Setting "storeDir"
$configuredCachePath = Resolve-RepositoryPath -Value $cacheSetting -Setting "cacheDir"
$configuredVirtualStorePath = Resolve-RepositoryPath -Value $virtualStoreSetting -Setting "virtualStoreDir"

$expectedStorePath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot ".pnpm-store"))
$expectedCachePath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot ".pnpm-cache"))
$expectedVirtualStorePath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "node_modules\.pnpm"))

Assert-ExactPath -Actual $configuredStorePath -Expected $expectedStorePath -Label "pnpm storeDir"
Assert-ExactPath -Actual $configuredCachePath -Expected $expectedCachePath -Label "pnpm cacheDir"
Assert-ExactPath -Actual $configuredVirtualStorePath -Expected $expectedVirtualStorePath -Label "pnpm virtualStoreDir"
Assert-WithinPath -Candidate $resolvedStorePath -Parent $expectedStorePath -Label "pnpm active store"

if ($globalVirtualStore -ne "false") {
    throw "pnpm enableGlobalVirtualStore must be false, but resolved to '$globalVirtualStore'."
}

[pscustomobject]@{
    RepositoryRoot = $repositoryRoot
    StoreDir = $configuredStorePath
    ActiveStore = $resolvedStorePath
    CacheDir = $configuredCachePath
    VirtualStoreDir = $configuredVirtualStorePath
    GlobalVirtualStore = $false
} | ConvertTo-Json

Write-Host "pnpm dependency layout verification passed."
