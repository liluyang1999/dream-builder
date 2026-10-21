$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
. (Join-Path $repositoryRoot "scripts\lib\source-tree.ps1")
. (Join-Path $repositoryRoot "scripts\lib\release-files.ps1")
$testRoot = Join-Path $repositoryRoot ("output\source-tree-test-" + [Guid]::NewGuid().ToString("N"))

function Assert-Changed {
    param([string]$Label, [string]$Original)
    if ((Get-DreamBuilderSourceTreeSha256 -Root $testRoot) -eq $Original) {
        throw "Source identity did not change for $Label."
    }
    Write-Host "PASS: $Label changes source identity"
}

try {
    Assert-DreamBuilderPathWithoutLinks -LiteralPath $testRoot
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    # The isolated fixture index never touches the project's Git repository or history.
    & git -C $testRoot -c core.excludesFile=/dev/null init --quiet --template=
    if ($LASTEXITCODE -ne 0) { throw "Could not initialize the source identity fixture." }
    & git -C $testRoot config --local core.excludesFile /dev/null
    if ($LASTEXITCODE -ne 0) { throw "Could not isolate the fixture ignore configuration." }
    $trackedPath = Join-Path $testRoot "tracked.txt"
    [IO.File]::WriteAllText($trackedPath, "source one")
    [IO.File]::WriteAllText((Join-Path $testRoot ".gitignore"), "cache/`n")
    & git -C $testRoot -c core.autocrlf=false -c core.excludesFile=/dev/null add -- tracked.txt .gitignore
    if ($LASTEXITCODE -ne 0) { throw "Could not index the source identity fixture." }
    $baseline = Get-DreamBuilderSourceTreeSha256 -Root $testRoot
    if ($baseline -notmatch '^[0-9A-F]{64}$' -or (Get-DreamBuilderSourceTreeSha256 -Root $testRoot) -ne $baseline) {
        throw "Source identity must be stable for unchanged bytes."
    }
    Write-Host "PASS: deterministic source identity independent of caller working directory"

    [IO.File]::WriteAllText($trackedPath, "source two")
    Assert-Changed "tracked source modification" $baseline
    [IO.File]::WriteAllText($trackedPath, "source one")
    $untrackedPath = Join-Path $testRoot "untracked.txt"
    [IO.File]::WriteAllText($untrackedPath, "new source")
    Assert-Changed "untracked source addition" $baseline
    Remove-Item -LiteralPath $untrackedPath
    Remove-Item -LiteralPath $trackedPath
    Assert-Changed "missing tracked source" $baseline
    [IO.File]::WriteAllText($trackedPath, "source one")
    New-Item -ItemType Directory -Path (Join-Path $testRoot "cache") | Out-Null
    [IO.File]::WriteAllText((Join-Path $testRoot "cache\generated.txt"), "ignored generated data")
    if ((Get-DreamBuilderSourceTreeSha256 -Root $testRoot) -ne $baseline) {
        throw "Ignored generated data changed source identity."
    }
    Write-Host "PASS: restoring source and adding ignored cache preserves source identity"
    Write-Host "5 source identity tests passed."
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
