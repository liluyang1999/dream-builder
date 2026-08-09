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

    if ($productVersion -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$') {
        throw "version.json productVersion must use the two-component form <major>.<feature>."
    }
    if ($null -ne $contract.PSObject.Properties["technicalVersion"]) {
        throw "version.json must not expose a second technicalVersion value."
    }
    $toolingVersion = "$productVersion.0"

    $packagePaths = [ordered]@{
        RootPackage = "package.json"
        DesktopPackage = "apps\desktop\package.json"
        IpcContractsPackage = "packages\ipc-contracts\package.json"
        LiquidGlassPackage = "packages\liquid-glass\package.json"
    }
    $toolingVersions = [ordered]@{}
    foreach ($entry in $packagePaths.GetEnumerator()) {
        $package = Read-ContractJson (Join-Path $resolvedRoot $entry.Value)
        $toolingVersions[$entry.Key] = [string]$package.version
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
    $toolingVersions.CargoWorkspace = $cargoVersionMatch.Groups[1].Value

    $tauriConfig = Read-ContractJson (
        Join-Path $resolvedRoot "crates\dream-builder\tauri.conf.json"
    )
    $toolingVersions.TauriBundle = [string]$tauriConfig.version

    $mismatches = @(
        $toolingVersions.GetEnumerator() |
            Where-Object { $_.Value -ne $toolingVersion } |
            ForEach-Object { "$($_.Key)=$($_.Value)" }
    )
    if ($mismatches.Count -gt 0) {
        throw "Tooling compatibility versions must all match the value derived from productVersion: $($mismatches -join ', ')"
    }

    $tauriDirectory = Join-Path $resolvedRoot "crates\dream-builder"
    $installerHookRelativePath = [string]$tauriConfig.bundle.windows.nsis.installerHooks
    if ([string]::IsNullOrWhiteSpace($installerHookRelativePath)) {
        throw "The NSIS installer must declare installerHooks for the two-component Windows display version."
    }
    $installerHookPath = [IO.Path]::GetFullPath(
        (Join-Path $tauriDirectory $installerHookRelativePath)
    )
    $tauriDirectoryPrefix = $tauriDirectory.TrimEnd("\") + "\"
    if (-not $installerHookPath.StartsWith(
        $tauriDirectoryPrefix,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "The NSIS installer hook must stay inside crates\dream-builder."
    }
    if (-not (Test-Path -LiteralPath $installerHookPath -PathType Leaf)) {
        throw "The NSIS installer hook does not exist: $installerHookPath"
    }

    $installerHook = Get-Content -LiteralPath $installerHookPath -Raw -Encoding UTF8
    $displayVersionMatch = [regex]::Match(
        $installerHook,
        '(?m)^\s*!define\s+DREAM_BUILDER_DISPLAY_VERSION\s+"([^"]+)"\s*$'
    )
    if (-not $displayVersionMatch.Success) {
        throw "The NSIS installer hook must define DREAM_BUILDER_DISPLAY_VERSION."
    }
    $installerDisplayVersion = $displayVersionMatch.Groups[1].Value
    if ($installerDisplayVersion -ne $productVersion) {
        throw "The NSIS Windows display version does not match version.json productVersion."
    }
    if ($installerHook -notmatch '(?s)!macro\s+NSIS_HOOK_POSTINSTALL.*?WriteRegStr\s+SHCTX\s+"\$\{UNINSTKEY\}"\s+"DisplayVersion".*?!macroend') {
        throw "The NSIS post-install hook must overwrite the uninstall entry DisplayVersion."
    }

    $installerTemplateRelativePath = [string]$tauriConfig.bundle.windows.nsis.template
    if ([string]::IsNullOrWhiteSpace($installerTemplateRelativePath)) {
        throw "The NSIS installer must declare a template for two-component EXE version strings."
    }
    $installerTemplatePath = [IO.Path]::GetFullPath(
        (Join-Path $tauriDirectory $installerTemplateRelativePath)
    )
    if (-not $installerTemplatePath.StartsWith(
        $tauriDirectoryPrefix,
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw "The NSIS installer template must stay inside crates\dream-builder."
    }
    if (-not (Test-Path -LiteralPath $installerTemplatePath -PathType Leaf)) {
        throw "The NSIS installer template does not exist: $installerTemplatePath"
    }
    $installerTemplate = Get-Content -LiteralPath $installerTemplatePath -Raw -Encoding UTF8
    $rootPackage = Read-ContractJson (Join-Path $resolvedRoot "package.json")
    $tauriCliProperty = $rootPackage.devDependencies.PSObject.Properties["@tauri-apps/cli"]
    if ($null -eq $tauriCliProperty -or [string]$tauriCliProperty.Value -notmatch '^\d+\.\d+\.\d+$') {
        throw "The copied NSIS template requires an exact @tauri-apps/cli version pin."
    }
    $tauriCliVersion = [string]$tauriCliProperty.Value
    if (
        -not $installerTemplate.Contains("Tauri CLI $tauriCliVersion default NSIS template") -or
        -not $installerTemplate.Contains("tauri-cli-v$tauriCliVersion/crates/tauri-bundler")
    ) {
        throw "The custom NSIS template provenance must match @tauri-apps/cli $tauriCliVersion."
    }
    foreach ($versionKey in @("FileVersion", "ProductVersion")) {
        $expectedInstruction = 'VIAddVersionKey "{0}" "${{DREAM_BUILDER_DISPLAY_VERSION}}"' -f $versionKey
        if (-not $installerTemplate.Contains($expectedInstruction)) {
            throw "The NSIS template must use the public display version for $versionKey."
        }
    }
    if (-not $installerTemplate.Contains(
        'WriteRegStr SHCTX "${UNINSTKEY}" "DisplayVersion" "${DREAM_BUILDER_DISPLAY_VERSION}"'
    )) {
        throw "The NSIS template must use the public display version for Installed Apps."
    }

    return [pscustomobject]@{
        ProductVersion = $productVersion
        ToolingVersion = $toolingVersion
        InstallerDisplayVersion = $installerDisplayVersion
        InstallerHookPath = $installerHookPath
        InstallerTemplatePath = $installerTemplatePath
        TauriCliVersion = $tauriCliVersion
        TauriConfig = $tauriConfig
    }
}
