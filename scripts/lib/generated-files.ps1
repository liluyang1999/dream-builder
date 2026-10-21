# Only the fixed, reproducible build outputs are managed here. Dependencies,
# release artifacts and player data deliberately have no cleanup entry.
function Get-DreamBuilderGeneratedPaths {
    @(
        "target",
        ".pnpm-cache",
        "node_modules\.vite",
        "apps\desktop\node_modules\.vite-temp",
        "apps\desktop\dist",
        "crates\dream-builder\gen"
    )
}

function Assert-DreamBuilderGeneratedPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    if ($RelativePath -notin @(Get-DreamBuilderGeneratedPaths)) {
        throw "Not a managed build output: $RelativePath"
    }
    $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\')
    $target = [IO.Path]::GetFullPath((Join-Path $rootPath $RelativePath))
    if (-not $target.StartsWith($rootPath + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Generated path escapes the repository: $target"
    }

    # Inspect every ancestor before descending: a safe-looking child below a
    # junction can still point outside the repository.
    $ancestor = $target
    while ($ancestor.Length -ge $rootPath.Length) {
        if (Test-Path -LiteralPath $ancestor) {
            $item = Get-Item -LiteralPath $ancestor -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw "Refusing to clean a linked path: $ancestor"
            }
            if (-not $item.PSIsContainer) {
                throw "Expected a generated directory: $ancestor"
            }
        }
        if ($ancestor -eq $rootPath) { break }
        $ancestor = [IO.Path]::GetDirectoryName($ancestor)
    }

    if (Test-Path -LiteralPath $target) {
        $pending = New-Object 'System.Collections.Generic.Stack[string]'
        $pending.Push($target)
        while ($pending.Count -gt 0) {
            foreach ($item in Get-ChildItem -LiteralPath $pending.Pop() -Force) {
                if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                    throw "Refusing to clean a directory containing a link: $($item.FullName)"
                }
                if ($item.PSIsContainer) { $pending.Push($item.FullName) }
            }
        }
    }
    return $target
}
