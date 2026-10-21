function Assert-DreamBuilderPathWithoutLinks {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [switch]$IncludeDescendants
    )

    $currentPath = [IO.Path]::GetFullPath($LiteralPath)
    while (-not [string]::IsNullOrWhiteSpace($currentPath)) {
        $item = $null
        try {
            $item = Get-Item -LiteralPath $currentPath -Force -ErrorAction Stop
        } catch {
            if ($_.CategoryInfo.Category -ne [Management.Automation.ErrorCategory]::ObjectNotFound) { throw }
        }
        if ($null -ne $item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Unsupported release entry: linked path '$currentPath'."
        }
        $parent = [IO.Directory]::GetParent($currentPath)
        $currentPath = if ($null -eq $parent) { $null } else { $parent.FullName }
    }
    if ($IncludeDescendants -and (Test-Path -LiteralPath $LiteralPath -PathType Container)) {
        $pending = New-Object 'System.Collections.Generic.Stack[string]'
        $pending.Push([IO.Path]::GetFullPath($LiteralPath))
        while ($pending.Count -gt 0) {
            foreach ($entry in @(Get-ChildItem -LiteralPath $pending.Pop() -Force)) {
                if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                    throw "Unsupported release entry: linked path '$($entry.FullName)'."
                }
                if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
            }
        }
    }
}

function Assert-DreamBuilderReleaseDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][string[]]$ExpectedNames,
        [switch]$AllowMissing,
        [switch]$AllowPartial
    )

    Assert-DreamBuilderPathWithoutLinks -LiteralPath $LiteralPath
    if (-not (Test-Path -LiteralPath $LiteralPath)) {
        if ($AllowMissing) { return }
        throw "Release directory does not exist: $LiteralPath"
    }
    if (-not (Test-Path -LiteralPath $LiteralPath -PathType Container)) {
        throw "Unsupported release entry: '$LiteralPath' is not a directory."
    }
    $entries = @(Get-ChildItem -LiteralPath $LiteralPath -Force)
    foreach ($entry in $entries) {
        if ($entry.PSIsContainer -or
            ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            ($entry.Attributes -band ([IO.FileAttributes]::Hidden -bor [IO.FileAttributes]::System)) -or
            $ExpectedNames -cnotcontains $entry.Name) {
            throw "Unsupported release entry: '$($entry.FullName)'."
        }
    }
    if (-not $AllowPartial -and $entries.Count -ne $ExpectedNames.Count) {
        throw "Release file set mismatch. Expected $($ExpectedNames.Count) files, got $($entries.Count)."
    }
}

function Remove-DreamBuilderReleaseStagingDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$LiteralPath,
        [Parameter(Mandatory = $true)][string[]]$ExpectedNames
    )

    Assert-DreamBuilderReleaseDirectory -LiteralPath $LiteralPath -ExpectedNames $ExpectedNames -AllowMissing -AllowPartial
    if (Test-Path -LiteralPath $LiteralPath -PathType Container) {
        # Delete only known direct files; never recursively traverse a release directory.
        foreach ($entry in @(Get-ChildItem -LiteralPath $LiteralPath -Force)) {
            Remove-Item -LiteralPath $entry.FullName -Force
        }
        Remove-Item -LiteralPath $LiteralPath -Force
    }
}

function Publish-DreamBuilderReleaseDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$StagingDirectory,
        [Parameter(Mandatory = $true)][string]$ReleaseDirectory,
        [Parameter(Mandatory = $true)][string[]]$ExpectedNames
    )

    $stagePath = [IO.Path]::GetFullPath($StagingDirectory)
    $releasePath = [IO.Path]::GetFullPath($ReleaseDirectory)
    if ($stagePath -eq $releasePath -or
        [IO.Directory]::GetParent($stagePath).FullName -ne [IO.Directory]::GetParent($releasePath).FullName) {
        throw "Release staging and destination must be different sibling directories."
    }
    Assert-DreamBuilderReleaseDirectory -LiteralPath $stagePath -ExpectedNames $ExpectedNames
    Assert-DreamBuilderReleaseDirectory -LiteralPath $releasePath -ExpectedNames $ExpectedNames -AllowMissing
    $backupPath = $releasePath + ".previous-" + [Guid]::NewGuid().ToString("N")
    $previousMoved = $false
    try {
        if (Test-Path -LiteralPath $releasePath) {
            [IO.Directory]::Move($releasePath, $backupPath)
            $previousMoved = $true
        }
        [IO.Directory]::Move($stagePath, $releasePath)
    } catch {
        if ($previousMoved -and -not (Test-Path -LiteralPath $releasePath)) {
            [IO.Directory]::Move($backupPath, $releasePath)
        }
        throw
    }
    if ($previousMoved) {
        Remove-DreamBuilderReleaseStagingDirectory -LiteralPath $backupPath -ExpectedNames $ExpectedNames
    }
}
