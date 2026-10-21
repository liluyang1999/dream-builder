param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Installed", "Absent")]
    [string]$ExpectedState,
    [string]$ExpectedInstallDirectory
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $PSScriptRoot "lib\version-contract.ps1")
. (Join-Path $PSScriptRoot "lib\install-state.ps1")
if ($ExpectedState -eq "Absent" -and [string]::IsNullOrWhiteSpace($ExpectedInstallDirectory)) {
    throw "Absent verification requires -ExpectedInstallDirectory from the Installed report; default paths cannot prove a custom installation was removed."
}
if (-not [string]::IsNullOrWhiteSpace($ExpectedInstallDirectory)) {
    $ExpectedInstallDirectory = Resolve-DreamBuilderInstallDirectory -Value $ExpectedInstallDirectory
}
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
        [Environment]::GetFolderPath("Programs"),
        [Environment]::GetFolderPath("CommonPrograms"),
        [Environment]::GetFolderPath("DesktopDirectory"),
        [Environment]::GetFolderPath("CommonDesktopDirectory")
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
    if (-not [string]::IsNullOrWhiteSpace($ExpectedInstallDirectory)) {
        $programDirectoryCandidates += $ExpectedInstallDirectory
    }
    $userDataDirectories = @(
        @("$env:LOCALAPPDATA\$($tauriConfig.identifier)", "$env:APPDATA\$($tauriConfig.identifier)") |
            Where-Object { Test-Path -LiteralPath $_ -PathType Container }
    )

    if ($ExpectedState -eq "Installed") {
        if ($installEntries.Count -ne 1) {
            throw "Expected exactly one '$productName' uninstall entry; found $($installEntries.Count)."
        }
        $entry = $installEntries[0]
        $displayVersion = [string](Get-OptionalPropertyValue $entry "DisplayVersion")
        if ($displayVersion -ne $version) {
            throw "Installed Apps version '$displayVersion' does not match product version '$version'."
        }
        $installLocation = (
            [string](Get-OptionalPropertyValue $entry "InstallLocation")
        ).Trim().Trim('"')
        if ([string]::IsNullOrWhiteSpace($installLocation)) {
            throw "The uninstall entry does not declare an install location."
        }
        $installLocation = Resolve-DreamBuilderInstallDirectory -Value $installLocation
        if (-not [string]::IsNullOrWhiteSpace($ExpectedInstallDirectory) -and
            -not [string]::Equals($installLocation, $ExpectedInstallDirectory, [StringComparison]::OrdinalIgnoreCase)) {
            throw "The installed location does not match -ExpectedInstallDirectory."
        }
        if (-not (Test-Path -LiteralPath $installLocation -PathType Container)) {
            throw "Install location does not exist: $installLocation"
        }
        $uninstallString = [string](Get-OptionalPropertyValue $entry "UninstallString")
        if ([string]::IsNullOrWhiteSpace($uninstallString)) {
            throw "The uninstall entry does not declare an uninstall command."
        }
        $uninstallerPath = Join-Path $installLocation "uninstall.exe"
        if ($uninstallString.Trim().Trim('"') -ne $uninstallerPath) {
            throw "The uninstall command does not target the installed uninstaller."
        }
        if (-not (Test-Path -LiteralPath $uninstallerPath -PathType Leaf)) {
            throw "The installed uninstaller does not exist: $uninstallerPath"
        }
        $uninstallerVersionInfo = (Get-Item -LiteralPath $uninstallerPath).VersionInfo
        foreach ($uninstallerVersion in @(
            [string]$uninstallerVersionInfo.ProductVersion,
            [string]$uninstallerVersionInfo.FileVersion
        )) {
            if ($uninstallerVersion.Trim() -ne $version) {
                throw "Player-visible uninstaller version '$uninstallerVersion' does not match product version '$version'."
            }
        }

        $mainExecutables = @(
            Get-ChildItem -LiteralPath $installLocation -Filter "*.exe" -File |
                Where-Object {
                    $_.Name -notmatch "uninstall" -and
                    $_.VersionInfo.ProductVersion.Trim() -eq $version -and
                    $_.VersionInfo.FileVersion.Trim() -eq $version
                }
        )
        if ($mainExecutables.Count -ne 1) {
            throw "Expected exactly one versioned application EXE; found $($mainExecutables.Count)."
        }
        $shell = New-Object -ComObject WScript.Shell
        try {
            $shortcutTargets = @(
                foreach ($shortcut in $shortcuts) {
                    $link = $shell.CreateShortcut($shortcut.FullName)
                    try {
                        [pscustomobject]@{ Path = $shortcut.FullName; TargetPath = [string]$link.TargetPath }
                    } finally {
                        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)
                    }
                }
            )
        } finally {
            [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
        }
        Assert-DreamBuilderShortcutTargets -Shortcuts $shortcutTargets -ExpectedExecutable $mainExecutables[0].FullName

        [pscustomobject]@{
            ExpectedState = $ExpectedState
            Product = $productName
            Version = $version
            InstallLocation = $installLocation
            MainExecutable = $mainExecutables[0].FullName
            Uninstaller = $uninstallerPath
            UninstallEntry = [string]$entry.PSPath
            Shortcuts = @($shortcuts | Select-Object -ExpandProperty FullName)
            RunningProcesses = $processes.Count
            UserDataPreserved = $userDataDirectories.Count -gt 0
            UserDataDirectories = $userDataDirectories
        } | ConvertTo-Json -Depth 4
    } else {
        if ($installEntries.Count -ne 0) {
            throw "Expected no '$productName' uninstall entry; found $($installEntries.Count)."
        }
        if ($shortcuts.Count -ne 0) {
            throw "Expected no '$productName' shortcuts; found $($shortcuts.Count)."
        }
        Assert-DreamBuilderAbsentInstallDirectories -Directories $programDirectoryCandidates
        if ($processes.Count -ne 0) {
            throw "Expected no running '$productName' process; found $($processes.Count)."
        }

        [pscustomobject]@{
            ExpectedState = $ExpectedState
            Product = $productName
            Version = $version
            CheckedInstallLocation = $ExpectedInstallDirectory
            UninstallEntries = 0
            ProgramDirectories = 0
            Shortcuts = 0
            RunningProcesses = 0
            UserDataPreserved = $userDataDirectories.Count -gt 0
            UserDataDirectories = $userDataDirectories
        } | ConvertTo-Json -Depth 3
    }
} finally {
    Pop-Location
}
