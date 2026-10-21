$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$testRoot = Join-Path $repositoryRoot ("output\release-files-test-" + [Guid]::NewGuid().ToString("N"))
$releaseDirectory = Join-Path $testRoot "candidate"
$version = (Get-Content -LiteralPath (Join-Path $repositoryRoot "version.json") -Raw | ConvertFrom-Json).productVersion
$names = @(
    "Dream-Builder-Fantasy-Tree_${version}_x64.exe",
    "Dream-Builder-Fantasy-Tree_${version}_x64-setup.exe",
    "LICENSE.txt", "README-zh-CN.md", "SHA256SUMS.txt", "release-manifest.json"
)
. (Join-Path $repositoryRoot "scripts\lib\release-files.ps1")
$passed = 0

function Assert-Fails {
    param([string]$Label, [scriptblock]$Action, [string]$Pattern)
    $message = $null
    try { & $Action } catch { $message = $_.Exception.Message }
    if ($null -eq $message -or $message -notlike $Pattern) {
        throw "$Label failed to reject the fixture. Actual error: $message"
    }
    $script:passed += 1
    Write-Host "PASS: $Label"
}

function Assert-ReleaseEntryRejected {
    param([string]$Label)
    $message = $null
    try {
        & (Join-Path $repositoryRoot "scripts\release-verify.ps1") -ReleaseDirectory $releaseDirectory
    } catch {
        $message = $_.Exception.Message
    }
    if ($null -eq $message -or $message -notlike "Unsupported release entry:*") {
        throw "$Label was not rejected by the release entry boundary. Actual error: $message"
    }
    Write-Host "PASS: $Label"
    $script:passed += 1
}

try {
    Assert-DreamBuilderPathWithoutLinks -LiteralPath $testRoot
    New-Item -ItemType Directory -Path $releaseDirectory | Out-Null
    foreach ($name in $names) {
        [IO.File]::WriteAllText((Join-Path $releaseDirectory $name), "{}")
    }
    $extraDirectory = Join-Path $releaseDirectory "unexpected"
    New-Item -ItemType Directory -Path $extraDirectory | Out-Null
    Assert-ReleaseEntryRejected "unexpected subdirectory"
    Remove-Item -LiteralPath $extraDirectory

    $hiddenFile = Join-Path $releaseDirectory "unexpected.txt"
    [IO.File]::WriteAllText($hiddenFile, "keep outside the release")
    [IO.File]::SetAttributes($hiddenFile, [IO.FileAttributes]::Hidden)
    Assert-ReleaseEntryRejected "unexpected hidden file"
    Remove-Item -LiteralPath $hiddenFile -Force

    $payload = Join-Path $releaseDirectory "LICENSE.txt"
    [IO.File]::SetAttributes($payload, [IO.FileAttributes]::Hidden)
    Assert-ReleaseEntryRejected "hidden payload"
    [IO.File]::SetAttributes($payload, [IO.FileAttributes]::Normal)

    $linkedPath = Join-Path $releaseDirectory "linked"
    $linkTarget = Join-Path $testRoot "link-target"
    New-Item -ItemType Directory -Path $linkTarget | Out-Null
    [IO.File]::WriteAllText((Join-Path $linkTarget "preserve.txt"), "preserve")
    try {
        New-Item -ItemType Junction -Path $linkedPath -Target $linkTarget | Out-Null
        Assert-ReleaseEntryRejected "junction inside release"
        Assert-Fails "fixture cleanup refuses nested links before traversing" {
            Assert-DreamBuilderPathWithoutLinks -LiteralPath $testRoot -IncludeDescendants
        } "Unsupported release entry:*"
        Assert-Fails "cleanup refuses a junction" {
            Remove-DreamBuilderReleaseStagingDirectory -LiteralPath $releaseDirectory -ExpectedNames $names
        } "Unsupported release entry:*"
        if (-not (Test-Path -LiteralPath (Join-Path $linkTarget "preserve.txt"))) {
            throw "The junction target was modified."
        }
    } finally {
        # Directory.Delete removes the junction itself without traversing its target.
        if (Test-Path -LiteralPath $linkedPath) { [IO.Directory]::Delete($linkedPath) }
    }
    $ancestorLink = Join-Path $testRoot "linked-parent"
    try {
        New-Item -ItemType Junction -Path $ancestorLink -Target $linkTarget | Out-Null
        Assert-Fails "output below a junction" {
            Assert-DreamBuilderReleaseDirectory -LiteralPath (Join-Path $ancestorLink "not-created") -ExpectedNames $names -AllowMissing
        } "Unsupported release entry:*"
    } finally {
        if (Test-Path -LiteralPath $ancestorLink) { [IO.Directory]::Delete($ancestorLink) }
    }

    $stageDirectory = Join-Path $testRoot "stage"
    New-Item -ItemType Directory -Path $stageDirectory | Out-Null
    [IO.File]::WriteAllText((Join-Path $releaseDirectory "LICENSE.txt"), "previous candidate")
    Assert-Fails "incomplete staging preserves previous candidate" {
        Publish-DreamBuilderReleaseDirectory -StagingDirectory $stageDirectory -ReleaseDirectory $releaseDirectory -ExpectedNames $names
    } "Release file set mismatch*"
    if ([IO.File]::ReadAllText((Join-Path $releaseDirectory "LICENSE.txt")) -ne "previous candidate") {
        throw "Failed staging changed the previous candidate."
    }
    foreach ($name in $names) {
        [IO.File]::WriteAllText((Join-Path $stageDirectory $name), "new candidate")
    }
    $unexpectedFile = Join-Path $releaseDirectory "user-file.txt"
    [IO.File]::WriteAllText($unexpectedFile, "preserve")
    Assert-Fails "unexpected destination content preserves both candidates" {
        Publish-DreamBuilderReleaseDirectory -StagingDirectory $stageDirectory -ReleaseDirectory $releaseDirectory -ExpectedNames $names
    } "Unsupported release entry:*"
    if ([IO.File]::ReadAllText($unexpectedFile) -ne "preserve" -or
        [IO.File]::ReadAllText((Join-Path $releaseDirectory "LICENSE.txt")) -ne "previous candidate") {
        throw "Preflight changed the destination."
    }
    Remove-Item -LiteralPath $unexpectedFile
    $lockedStagePayload = [IO.File]::Open((Join-Path $stageDirectory "LICENSE.txt"), [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
    try {
        Assert-Fails "publication failure restores previous candidate" {
            Publish-DreamBuilderReleaseDirectory -StagingDirectory $stageDirectory -ReleaseDirectory $releaseDirectory -ExpectedNames $names
        } "*"
        if ([IO.File]::ReadAllText((Join-Path $releaseDirectory "LICENSE.txt")) -ne "previous candidate") {
            throw "Publication failure did not restore the previous candidate."
        }
    } finally {
        $lockedStagePayload.Dispose()
    }
    Publish-DreamBuilderReleaseDirectory -StagingDirectory $stageDirectory -ReleaseDirectory $releaseDirectory -ExpectedNames $names
    Assert-DreamBuilderReleaseDirectory -LiteralPath $releaseDirectory -ExpectedNames $names
    if ((Test-Path -LiteralPath $stageDirectory) -or
        [IO.File]::ReadAllText((Join-Path $releaseDirectory "LICENSE.txt")) -ne "new candidate" -or
        @(Get-ChildItem -LiteralPath $testRoot -Filter "candidate.previous-*").Count -ne 0) {
        throw "Successful publication did not replace and clean the previous candidate."
    }
    $passed += 1
    Write-Host "PASS: complete staging replaces the previous candidate and removes its backup"
    Remove-DreamBuilderReleaseStagingDirectory -LiteralPath $releaseDirectory -ExpectedNames $names
    if (Test-Path -LiteralPath $releaseDirectory) { throw "Staging cleanup did not remove its directory." }
    $passed += 1
    Write-Host "PASS: known staging files are cleaned without recursive traversal"
    Write-Host "$passed release filesystem tests passed."
} finally {
    # This random fixture is created by this test and contains only regular files/directories.
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
