function Get-DreamBuilderSha256 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LiteralPath
    )

    $resolvedPath = [IO.Path]::GetFullPath($LiteralPath)
    $stream = [IO.File]::Open(
        $resolvedPath,
        [IO.FileMode]::Open,
        [IO.FileAccess]::Read,
        [IO.FileShare]::Read
    )
    $sha256 = $null
    try {
        $sha256 = [Security.Cryptography.SHA256]::Create()
        return (
            $sha256.ComputeHash($stream) |
                ForEach-Object { $_.ToString("X2") }
        ) -join ""
    } finally {
        if ($null -ne $sha256) {
            $sha256.Dispose()
        }
        $stream.Dispose()
    }
}
