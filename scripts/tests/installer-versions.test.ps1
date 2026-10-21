param([string]$NsisDirectory = (Join-Path $env:LOCALAPPDATA "tauri\NSIS"))

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
. (Join-Path $repositoryRoot "scripts\lib\release-files.ps1")
$compiler = Join-Path $NsisDirectory "makensis.exe"
$pluginDirectory = Join-Path $NsisDirectory "Plugins\x86-unicode\additional"
if (-not (Test-Path -LiteralPath $compiler -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $pluginDirectory "nsis_tauri_utils.dll") -PathType Leaf)) {
    throw "NSIS compiler/plugin missing. Run the Tauri Windows bundle first or pass -NsisDirectory."
}
$testRoot = Join-Path $repositoryRoot ("output\installer-version-test-" + [Guid]::NewGuid().ToString("N"))
try {
    Assert-DreamBuilderPathWithoutLinks -LiteralPath $testRoot
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    $testExecutable = Join-Path $testRoot "version-tests.exe"
    $versionHook = Join-Path $repositoryRoot "crates\dream-builder\installer\version-display.nsh"
    & $compiler /V2 "/DTEST_PLUGIN_DIR=$pluginDirectory" "/DTEST_OUTPUT=$testExecutable" "/DTEST_VERSION_HOOK=$versionHook" (Join-Path $PSScriptRoot "installer-versions.nsi")
    if ($LASTEXITCODE -ne 0) { throw "NSIS version test compilation failed with exit code $LASTEXITCODE." }
    $cases = @(
        @{ Name = "12 comparison cases"; Arguments = ""; ExpectedExitCode = 0 },
        @{ Name = "silent downgrade rejected"; Arguments = "/downgrade"; ExpectedExitCode = 2 },
        @{ Name = "invalid installed version rejected"; Arguments = "/invalid"; ExpectedExitCode = 2 },
        @{ Name = "silent upgrade accepted"; Arguments = "/upgrade"; ExpectedExitCode = 0 },
        @{ Name = "silent reinstall accepted"; Arguments = "/reinstall"; ExpectedExitCode = 0 }
    )
    foreach ($case in $cases) {
        $startArguments = @{ FilePath = $testExecutable; PassThru = $true; WindowStyle = "Hidden" }
        if ($case.Arguments -ne "") { $startArguments.ArgumentList = $case.Arguments }
        $process = Start-Process @startArguments
        try {
            if (-not $process.WaitForExit(15000)) {
                $process.Kill()
                $process.WaitForExit()
                throw "NSIS version test exceeded its 15 second limit."
            }
            if ($process.ExitCode -ne $case.ExpectedExitCode) {
                throw "NSIS test '$($case.Name)' expected exit $($case.ExpectedExitCode), got $($process.ExitCode)."
            }
        } finally {
            $process.Dispose()
        }
        Write-Host "PASS: $($case.Name)"
    }
    Write-Host "16 NSIS native version and silent-install policy tests passed."
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
