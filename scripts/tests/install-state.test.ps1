$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
. (Join-Path $repositoryRoot "scripts\lib\release-files.ps1")
$verificationScript = Join-Path $repositoryRoot "scripts\release-install-state.ps1"
$message = $null
try {
    & $verificationScript -ExpectedState Absent
} catch {
    $message = $_.Exception.Message
}
if ($message -notlike "Absent verification requires -ExpectedInstallDirectory*") {
    throw "Uninstall verification must require the actual installation path before reading host state. Actual error: $message"
}
Write-Host "PASS: uninstall verification requires an explicit installation path"
. (Join-Path $repositoryRoot "scripts\lib\install-state.ps1")

function Assert-Fails {
    param([string]$Label, [scriptblock]$Action, [string]$Pattern)
    $message = $null
    try { & $Action } catch { $message = $_.Exception.Message }
    if ($null -eq $message -or $message -notlike $Pattern) {
        throw "$Label failed to reject the fixture. Actual error: $message"
    }
    Write-Host "PASS: $Label"
}

$testRoot = Join-Path $repositoryRoot ("output\install-state-test-" + [Guid]::NewGuid().ToString("N"))
try {
    Assert-DreamBuilderPathWithoutLinks -LiteralPath $testRoot
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    $customDirectory = Join-Path $testRoot "custom-install"
    New-Item -ItemType Directory -Path $customDirectory | Out-Null
    Assert-Fails "custom installation leftovers" {
        Assert-DreamBuilderAbsentInstallDirectories -Directories @($customDirectory)
    } "Installed program directories remain:*"
    Remove-Item -LiteralPath $customDirectory
    Assert-DreamBuilderAbsentInstallDirectories -Directories @($customDirectory)
    Write-Host "PASS: removed custom installation directory"

    Assert-Fails "relative install path" { Resolve-DreamBuilderInstallDirectory "relative\path" } "*must be an absolute path*"
    Assert-Fails "drive-relative install path" { Resolve-DreamBuilderInstallDirectory "D:relative" } "*must be an absolute path*"
    Assert-Fails "drive-root install path" { Resolve-DreamBuilderInstallDirectory "D:\" } "*cannot be a drive root*"

    $expectedExecutable = Join-Path $customDirectory "dream-builder.exe"
    Assert-Fails "shortcut with the right name and wrong target" {
        Assert-DreamBuilderShortcutTargets -Shortcuts @([pscustomobject]@{ Path = "Dream Builder Fantasy Tree.lnk"; TargetPath = "C:\Windows\notepad.exe" }) -ExpectedExecutable $expectedExecutable
    } "Shortcut does not target the installed application:*"
    Assert-Fails "missing shortcut" {
        Assert-DreamBuilderShortcutTargets -Shortcuts @() -ExpectedExecutable $expectedExecutable
    } "No Start menu or desktop shortcut*"
    Assert-DreamBuilderShortcutTargets -Shortcuts @([pscustomobject]@{ Path = "Dream Builder Fantasy Tree.lnk"; TargetPath = $expectedExecutable }) -ExpectedExecutable $expectedExecutable
    Write-Host "PASS: shortcut targets the installed application"
    Write-Host "9 installation state tests passed."
} finally {
    if (Test-Path -LiteralPath $testRoot) {
        $resolvedTestRoot = [IO.Path]::GetFullPath($testRoot)
        $outputPrefix = [IO.Path]::GetFullPath((Join-Path $repositoryRoot "output")) + "\"
        if (-not $resolvedTestRoot.StartsWith($outputPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Test cleanup escaped the repository output directory."
        }
        Assert-DreamBuilderPathWithoutLinks -LiteralPath $resolvedTestRoot -IncludeDescendants
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
    }
}
