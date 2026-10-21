[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $PSScriptRoot "lib\generated-files.ps1")

# Validate the entire plan before removing anything, so an unsafe later entry
# cannot cause a partially executed cleanup.
$plan = @(foreach ($relative in Get-DreamBuilderGeneratedPaths) {
    $path = Assert-DreamBuilderGeneratedPath -Root $repositoryRoot -RelativePath $relative
    if (Test-Path -LiteralPath $path) {
        [pscustomobject]@{ Relative = $relative; Path = $path }
    }
})
$running = @(Get-Process -Name "dream-builder" -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.Path.StartsWith($repositoryRoot + '\', [StringComparison]::OrdinalIgnoreCase) })
if ($running.Count -gt 0) {
    throw "Close the project application before cleaning generated files."
}

foreach ($entry in $plan) {
    if ($PSCmdlet.ShouldProcess($entry.Path, "Remove reproducible build output")) {
        # Recheck immediately before mutation, including hidden descendants.
        $null = Assert-DreamBuilderGeneratedPath -Root $repositoryRoot -RelativePath $entry.Relative
        if ($entry.Relative -eq "target") {
            & cargo clean --manifest-path (Join-Path $repositoryRoot "Cargo.toml") --target-dir $entry.Path
            if ($LASTEXITCODE -ne 0) { throw "Cargo cleanup failed." }
        } else {
            Remove-Item -LiteralPath $entry.Path -Recurse -Force
        }
        if (Test-Path -LiteralPath $entry.Path) { throw "Generated directory remains: $($entry.Path)" }
    }
}
if ($WhatIfPreference) {
    Write-Host "Cleanup preview complete; no generated files were removed."
} else {
    Write-Host "Build cleanup complete. Dependencies, release artifacts and player data are preserved."
}
