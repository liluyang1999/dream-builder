param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Installed", "Absent")]
    [string]$ExpectedState
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $PSScriptRoot "lib\version-contract.ps1")
Push-Location $repositoryRoot

try {
    function Get-OptionalPropertyValue {
        param(
            [Parameter(Mandatory = $true)]$InputObject,
            [Parameter(Mandatory = $true)][string]$Name
        )

        $property = $InputObject.PSObject.Properties[$Name]
        if ($null -eq $property) {
            return $null
        }
        return $property.Value
    }

    $versionContract = Get-DreamBuilderVersionContract -RepositoryRoot $repositoryRoot
    $tauriConfig = $versionContract.TauriConfig
    $productName = [string]$tauriConfig.productName
    $version = $versionContract.ProductVersion
    $technicalVersion = $versionContract.TechnicalVersion

    $uninstallRoots = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    $installEntries = @(
        Get-ItemProperty -Path $uninstallRoots -ErrorAction SilentlyContinue |
            Where-Object {
                [string](Get-OptionalPropertyValue $_ "DisplayName") -eq $productName
            }
    )

    $shortcutRoots = @(
        "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
        "$env:ProgramData\Microsoft\Windows\Start Menu\Programs",
        "$env:USERPROFILE\Desktop",
        "$env:PUBLIC\Desktop"
    )
    $shortcuts = @(
        Get-ChildItem -LiteralPath $shortcutRoots -Recurse -Filter "*.lnk" -ErrorAction SilentlyContinue |
            Where-Object {
                $_.BaseName -eq $productName -or
                $_.BaseName -eq "Dream Builder Fantasy Tree"
            }
    )

    $processes = @(
        Get-Process -ErrorAction SilentlyContinue |
            Where-Object {
                $_.ProcessName -eq "dream-builder" -or
                $_.MainWindowTitle -eq $productName
            }
    )

    $programDirectoryCandidates = @(
        "$env:LOCALAPPDATA\$productName",
        "$env:LOCALAPPDATA\Programs\$productName",
        "$env:ProgramFiles\$productName"
    )
    $programFilesX86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
    if (-not [string]::IsNullOrWhiteSpace($programFilesX86)) {
        $programDirectoryCandidates += (Join-Path $programFilesX86 $productName)
    }
    $existingProgramDirectories = @(
        $programDirectoryCandidates |
            Where-Object { Test-Path -LiteralPath $_ -PathType Container }
    )

    if ($ExpectedState -eq "Installed") {
        if ($installEntries.Count -ne 1) {
            throw "Expected exactly one '$productName' uninstall entry; found $($installEntries.Count)."
        }
        $entry = $installEntries[0]
        $displayVersion = [string](Get-OptionalPropertyValue $entry "DisplayVersion")
        if ($displayVersion -ne $technicalVersion) {
            throw "Installed version '$displayVersion' does not match technical version '$technicalVersion'."
        }
        $installLocation = (
            [string](Get-OptionalPropertyValue $entry "InstallLocation")
        ).Trim().Trim('"')
        if ([string]::IsNullOrWhiteSpace($installLocation)) {
            throw "The uninstall entry does not declare an install location."
        }
        if (-not (Test-Path -LiteralPath $installLocation -PathType Container)) {
            throw "Install location does not exist: $installLocation"
        }
        $uninstallString = [string](Get-OptionalPropertyValue $entry "UninstallString")
        if ([string]::IsNullOrWhiteSpace($uninstallString)) {
            throw "The uninstall entry does not declare an uninstall command."
        }

        $mainExecutables = @(
            Get-ChildItem -LiteralPath $installLocation -Filter "*.exe" -File |
                Where-Object {
                    $_.Name -notmatch "uninstall" -and
                    $_.VersionInfo.ProductVersion.StartsWith(
                        $technicalVersion,
                        [StringComparison]::Ordinal
                    )
                }
        )
        if ($mainExecutables.Count -ne 1) {
            throw "Expected exactly one versioned application EXE; found $($mainExecutables.Count)."
        }
        if ($shortcuts.Count -lt 1) {
            throw "No Start menu or desktop shortcut was found for '$productName'."
        }

        [pscustomobject]@{
            ExpectedState = $ExpectedState
            Product = $productName
            Version = $version
            TechnicalVersion = $technicalVersion
            InstallLocation = $installLocation
            MainExecutable = $mainExecutables[0].FullName
            UninstallEntry = [string]$entry.PSPath
            Shortcuts = @($shortcuts | Select-Object -ExpandProperty FullName)
            RunningProcesses = $processes.Count
            UserDataPreserved = Test-Path -LiteralPath (
                "$env:LOCALAPPDATA\$($tauriConfig.identifier)"
            )
        } | ConvertTo-Json -Depth 4
    } else {
        if ($installEntries.Count -ne 0) {
            throw "Expected no '$productName' uninstall entry; found $($installEntries.Count)."
        }
        if ($shortcuts.Count -ne 0) {
            throw "Expected no '$productName' shortcuts; found $($shortcuts.Count)."
        }
        if ($existingProgramDirectories.Count -ne 0) {
            throw "Installed program directories remain: $($existingProgramDirectories -join ', ')"
        }
        if ($processes.Count -ne 0) {
            throw "Expected no running '$productName' process; found $($processes.Count)."
        }

        [pscustomobject]@{
            ExpectedState = $ExpectedState
            Product = $productName
            Version = $version
            TechnicalVersion = $technicalVersion
            UninstallEntries = 0
            ProgramDirectories = 0
            Shortcuts = 0
            RunningProcesses = 0
            UserDataPreserved = Test-Path -LiteralPath (
                "$env:LOCALAPPDATA\$($tauriConfig.identifier)"
            )
        } | ConvertTo-Json -Depth 3
    }
} finally {
    Pop-Location
}
