function Get-DreamBuilderVersionContract {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepositoryRoot
    )

    $resolvedRoot = [IO.Path]::GetFullPath($RepositoryRoot)

    function Read-ContractJson {
        param([Parameter(Mandatory = $true)][string]$Path)

        return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    }

    $contract = Read-ContractJson (Join-Path $resolvedRoot "version.json")
    $productVersion = [string]$contract.productVersion
    $technicalVersion = [string]$contract.technicalVersion

    if ($productVersion -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') {
        throw "version.json productVersion must use the two-component form <major>.<feature>."
    }
    if ($technicalVersion -ne "$productVersion.0") {
        throw "version.json technicalVersion must be productVersion with a '.0' compatibility component."
    }

    $packagePaths = [ordered]@{
        RootPackage = "package.json"
        DesktopPackage = "apps\desktop\package.json"
        IpcContractsPackage = "packages\ipc-contracts\package.json"
        LiquidGlassPackage = "packages\liquid-glass\package.json"
    }
    $technicalVersions = [ordered]@{}
    foreach ($entry in $packagePaths.GetEnumerator()) {
        $package = Read-ContractJson (Join-Path $resolvedRoot $entry.Value)
        $technicalVersions[$entry.Key] = [string]$package.version
    }

    $cargoManifest = Get-Content -LiteralPath (
        Join-Path $resolvedRoot "Cargo.toml"
    ) -Raw -Encoding UTF8
    $cargoVersionMatch = [regex]::Match(
        $cargoManifest,
        '(?ms)^\[workspace\.package\]\s*.*?^version\s*=\s*"([^"]+)"'
    )
    if (-not $cargoVersionMatch.Success) {
        throw "Could not read [workspace.package] version from Cargo.toml."
    }
    $technicalVersions.CargoWorkspace = $cargoVersionMatch.Groups[1].Value

    $tauriConfig = Read-ContractJson (
        Join-Path $resolvedRoot "crates\dream-builder\tauri.conf.json"
    )
    $technicalVersions.TauriBundle = [string]$tauriConfig.version

    $mismatches = @(
        $technicalVersions.GetEnumerator() |
            Where-Object { $_.Value -ne $technicalVersion } |
            ForEach-Object { "$($_.Key)=$($_.Value)" }
    )
    if ($mismatches.Count -gt 0) {
        throw "Technical versions must all equal '$technicalVersion': $($mismatches -join ', ')"
    }

    return [pscustomobject]@{
        ProductVersion = $productVersion
        TechnicalVersion = $technicalVersion
        TauriConfig = $tauriConfig
    }
}
