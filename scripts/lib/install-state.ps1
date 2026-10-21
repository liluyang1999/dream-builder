function Resolve-DreamBuilderInstallDirectory {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value -notmatch '^[A-Za-z]:[\\/]' -and $Value -notmatch '^\\\\[^\\/]+\\[^\\/]+(?:\\|$)') {
        throw "The expected installation directory must be an absolute path."
    }
    $fullPath = [IO.Path]::GetFullPath($Value).TrimEnd('\', '/')
    if ($fullPath -eq [IO.Path]::GetPathRoot($fullPath).TrimEnd('\', '/')) {
        throw "The expected installation directory cannot be a drive root."
    }
    return $fullPath
}

function Assert-DreamBuilderAbsentInstallDirectories {
    param([Parameter(Mandatory = $true)][string[]]$Directories)

    $remaining = @($Directories | Where-Object { Test-Path -LiteralPath $_ })
    if ($remaining.Count -ne 0) {
        throw "Installed program directories remain: $($remaining -join ', ')"
    }
}

function Assert-DreamBuilderShortcutTargets {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Shortcuts,
        [Parameter(Mandatory = $true)][string]$ExpectedExecutable
    )

    if ($Shortcuts.Count -eq 0) {
        throw "No Start menu or desktop shortcut was found for the installed application."
    }
    $expectedPath = [IO.Path]::GetFullPath($ExpectedExecutable)
    foreach ($shortcut in $Shortcuts) {
        $target = [string]$shortcut.TargetPath
        if ([string]::IsNullOrWhiteSpace($target) -or
            -not [IO.Path]::IsPathRooted($target) -or
            -not [string]::Equals([IO.Path]::GetFullPath($target), $expectedPath, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Shortcut does not target the installed application: $($shortcut.Path)"
        }
    }
}
