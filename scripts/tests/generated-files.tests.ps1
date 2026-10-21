$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
. (Join-Path $repositoryRoot "scripts\lib\generated-files.ps1")
. (Join-Path $repositoryRoot "scripts\lib\release-files.ps1")
$fixture = Join-Path $repositoryRoot ("output\cleanup-tests-" + [Guid]::NewGuid().ToString("N"))
Assert-DreamBuilderPathWithoutLinks -LiteralPath $fixture
$null = New-Item -ItemType Directory -Path $fixture
$junctions = New-Object 'System.Collections.Generic.List[string]'
$checks = 0

function Assert-Rejected {
    param([scriptblock]$Action, [string]$Message)
    try { & $Action | Out-Null } catch {
        if ($_.Exception.Message -notlike $Message) { throw }
        return
    }
    throw "Expected rejection matching '$Message'."
}

try {
    $root = Join-Path $fixture "project"
    $outside = Join-Path $fixture "preserved"
    $null = New-Item -ItemType Directory -Path $root, $outside
    $sentinel = Join-Path $outside "keep.txt"
    [IO.File]::WriteAllText($sentinel, "preserved")

    foreach ($relative in Get-DreamBuilderGeneratedPaths) {
        $expected = Join-Path $root $relative
        if ((Assert-DreamBuilderGeneratedPath $root $relative) -ne $expected) {
            throw "Incorrect managed path: $relative"
        }
        $checks++
    }
    foreach ($relative in @("..\preserved", ".", "output\release", "node_modules", ".pnpm-store", $outside)) {
        Assert-Rejected { Assert-DreamBuilderGeneratedPath $root $relative } "Not a managed build output:*"
        $checks++
    }

    $target = Join-Path $root "target"
    $null = New-Item -ItemType Directory -Path $target
    [IO.File]::WriteAllText((Join-Path $target "generated.bin"), "build output")
    $null = Assert-DreamBuilderGeneratedPath $root "target"
    $checks++
    $link = Join-Path $target "nested-link"
    $null = New-Item -ItemType Junction -Path $link -Target $outside
    $junctions.Add($link)
    Assert-Rejected { Assert-DreamBuilderGeneratedPath $root "target" } "Refusing to clean a directory containing a link:*"
    $checks++

    $modules = Join-Path $root "node_modules"
    $null = New-Item -ItemType Junction -Path $modules -Target $outside
    $junctions.Add($modules)
    Assert-Rejected { Assert-DreamBuilderGeneratedPath $root "node_modules\.vite" } "Refusing to clean a linked path:*"
    $checks++

    # Exercise the public cleanup script against an isolated copied workspace.
    # A later invalid entry must not delete an earlier valid cache directory.
    $integrationRoot = Join-Path $fixture "cleanup-workspace"
    $library = Join-Path $integrationRoot "scripts\lib"
    $null = New-Item -ItemType Directory -Path $library
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "scripts\clean.ps1") -Destination (Join-Path $integrationRoot "scripts\clean.ps1")
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "scripts\lib\generated-files.ps1") -Destination $library
    $cache = Join-Path $integrationRoot ".pnpm-cache"
    $desktop = Join-Path $integrationRoot "apps\desktop"
    $dependency = Join-Path $integrationRoot "node_modules\keep.txt"
    $null = New-Item -ItemType Directory -Path $cache, $desktop, (Split-Path $dependency)
    [IO.File]::WriteAllText((Join-Path $cache "cache.bin"), "reproducible")
    [IO.File]::WriteAllText($dependency, "required dependency")
    $badOutput = Join-Path $desktop "dist"
    $null = New-Item -ItemType Junction -Path $badOutput -Target $outside
    $junctions.Add($badOutput)
    $cleanupScript = Join-Path $integrationRoot "scripts\clean.ps1"
    $stdout = Join-Path $fixture "cleanup.out.txt"
    $stderr = Join-Path $fixture "cleanup.err.txt"
    $baseArguments = @("-NoLogo", "-NoProfile", "-File", ('"' + $cleanupScript + '"'))
    $process = Start-Process -FilePath (Join-Path $PSHOME "powershell.exe") -ArgumentList $baseArguments -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    if ($process.ExitCode -eq 0 -or -not (Test-Path -LiteralPath $cache) -or
        [IO.File]::ReadAllText($stderr) -notlike "*linked path*") {
        throw "Unsafe cleanup plan must fail before removing any earlier entry."
    }
    $process.Dispose()
    $checks++
    [IO.Directory]::Delete($badOutput)
    $process = Start-Process -FilePath (Join-Path $PSHOME "powershell.exe") -ArgumentList ($baseArguments + "-WhatIf") -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $cache)) {
        throw "Cleanup preview must preserve all files."
    }
    $process.Dispose()
    $checks++
    $process = Start-Process -FilePath (Join-Path $PSHOME "powershell.exe") -ArgumentList $baseArguments -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    if ($process.ExitCode -ne 0 -or (Test-Path -LiteralPath $cache) -or
        [IO.File]::ReadAllText($dependency) -ne "required dependency") {
        throw "Cleanup must remove managed output and preserve dependencies."
    }
    $process.Dispose()
    $checks++
    if ([IO.File]::ReadAllText($sentinel) -ne "preserved") { throw "Unmanaged data changed." }
    Write-Host "Generated-file safety tests passed: $checks checks."
} finally {
    # Remove links themselves first; never traverse their targets during cleanup.
    foreach ($link in $junctions) {
        if (Test-Path -LiteralPath $link) { [IO.Directory]::Delete($link) }
    }
    $fullFixture = [IO.Path]::GetFullPath($fixture)
    $outputRoot = [IO.Path]::GetFullPath((Join-Path $repositoryRoot "output")) + '\'
    if (-not $fullFixture.StartsWith($outputRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe fixture cleanup path."
    }
    Assert-DreamBuilderPathWithoutLinks -LiteralPath $fullFixture -IncludeDescendants
    Remove-Item -LiteralPath $fullFixture -Recurse -Force
}
