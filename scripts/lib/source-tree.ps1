. (Join-Path $PSScriptRoot "file-hash.ps1")

function Get-DreamBuilderSourceTreeSha256 {
    param([Parameter(Mandatory = $true)][string]$Root)

    $relativePaths = [string[]]@(
        & git -C $Root -c core.quotepath=false ls-files --cached --others --exclude-standard
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Could not enumerate the Git source tree."
    }
    [Array]::Sort($relativePaths, [StringComparer]::Ordinal)

    $records = foreach ($relativePath in $relativePaths) {
        $nativeRelativePath = $relativePath.Replace("/", [IO.Path]::DirectorySeparatorChar)
        $fullPath = Join-Path $Root $nativeRelativePath
        if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
            $item = Get-Item -LiteralPath $fullPath
            $hash = Get-DreamBuilderSha256 -LiteralPath $fullPath
            "$relativePath`t$($item.Length)`t$hash"
        } else {
            "$relativePath`tMISSING"
        }
    }

    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    $indexBytes = $utf8WithoutBom.GetBytes(([string]::Join("`n", $records) + "`n"))
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try {
        return (
            $sha256.ComputeHash($indexBytes) |
                ForEach-Object { $_.ToString("X2") }
        ) -join ""
    } finally {
        $sha256.Dispose()
    }
}
