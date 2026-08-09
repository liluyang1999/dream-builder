param(
    [string]$ReleaseDirectory,
    [switch]$RequireCleanSource,
    [switch]$RequireSigned
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
. (Join-Path $PSScriptRoot "lib\version-contract.ps1")
Push-Location $repositoryRoot

try {
    function Read-JsonFile {
        param([Parameter(Mandatory = $true)][string]$Path)
        return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    }

    function Assert-Equal {
        param(
            [Parameter(Mandatory = $true)]$Actual,
            [Parameter(Mandatory = $true)]$Expected,
            [Parameter(Mandatory = $true)][string]$Label
        )

        if ($Actual -ne $Expected) {
            throw "$Label mismatch. Expected '$Expected', got '$Actual'."
        }
    }

    function Assert-SameNames {
        param(
            [Parameter(Mandatory = $true)][string[]]$Actual,
            [Parameter(Mandatory = $true)][string[]]$Expected,
            [Parameter(Mandatory = $true)][string]$Label
        )

        $difference = @(
            Compare-Object ($Expected | Sort-Object) ($Actual | Sort-Object)
        )
        if ($difference.Count -gt 0) {
            $actualReport = ($Actual | Sort-Object) -join ", "
            $expectedReport = ($Expected | Sort-Object) -join ", "
            throw "$Label mismatch. Expected [$expectedReport], got [$actualReport]."
        }
    }

    function Get-SourceTreeSha256 {
        param([Parameter(Mandatory = $true)][string]$Root)

        $relativePaths = [string[]]@(
            & git -c core.quotepath=false ls-files --cached --others --exclude-standard
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
                $hash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash
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

    $versionContract = Get-DreamBuilderVersionContract -RepositoryRoot $repositoryRoot
    $version = $versionContract.ProductVersion
    $technicalVersion = $versionContract.TechnicalVersion
    $tauriConfig = $versionContract.TauriConfig

    $resolvedReleaseDirectory = if ([string]::IsNullOrWhiteSpace($ReleaseDirectory)) {
        [IO.Path]::GetFullPath(
            (Join-Path $repositoryRoot "output\release\$version")
        )
    } elseif ([IO.Path]::IsPathRooted($ReleaseDirectory)) {
        [IO.Path]::GetFullPath($ReleaseDirectory)
    } else {
        [IO.Path]::GetFullPath((Join-Path $repositoryRoot $ReleaseDirectory))
    }
    if (-not (Test-Path -LiteralPath $resolvedReleaseDirectory -PathType Container)) {
        throw "Release directory does not exist: $resolvedReleaseDirectory"
    }

    $portableName = "Dream-Builder-Fantasy-Tree_${version}_x64.exe"
    $installerName = "Dream-Builder-Fantasy-Tree_${version}_x64-setup.exe"
    $payloadNames = @(
        $portableName,
        $installerName,
        "LICENSE.txt",
        "README-zh-CN.md"
    )
    $expectedDirectoryNames = @(
        $payloadNames
        "SHA256SUMS.txt"
        "release-manifest.json"
    )
    $actualDirectoryNames = @(
        Get-ChildItem -LiteralPath $resolvedReleaseDirectory -File |
            Select-Object -ExpandProperty Name
    )
    Assert-SameNames $actualDirectoryNames $expectedDirectoryNames "Release file set"

    $manifestPath = Join-Path $resolvedReleaseDirectory "release-manifest.json"
    $manifest = Read-JsonFile $manifestPath
    Assert-Equal ([int]$manifest.schemaVersion) 4 "Manifest schema version"
    Assert-Equal ([string]$manifest.product) ([string]$tauriConfig.productName) "Product name"
    Assert-Equal ([string]$manifest.version) $version "Manifest version"
    Assert-Equal ([string]$manifest.technicalVersion) $technicalVersion "Manifest technical version"
    Assert-Equal ([string]$manifest.platform) "windows-x64" "Target platform"
    $releaseKind = [string]$manifest.releaseKind
    if ($releaseKind -notin @("candidate", "production")) {
        throw "Manifest releaseKind must be 'candidate' or 'production'."
    }
    if ($RequireSigned -and $releaseKind -ne "production") {
        throw "Production verification requires manifest releaseKind='production'."
    }

    try {
        [void][DateTimeOffset]::Parse([string]$manifest.generatedAtUtc)
    } catch {
        throw "Manifest generatedAtUtc is not a valid timestamp."
    }
    if ([string]$manifest.sourceCommit -notmatch '^[0-9a-fA-F]{40,64}$') {
        throw "Manifest sourceCommit is not a Git object identifier."
    }

    $headCommit = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Could not resolve the current Git commit."
    }
    Assert-Equal ([string]$manifest.sourceCommit) $headCommit "Manifest source commit"
    & git cat-file -e "$($manifest.sourceCommit)^{commit}"
    if ($LASTEXITCODE -ne 0) {
        throw "Manifest source commit does not resolve to a commit."
    }
    if ([string]$manifest.sourceTreeSha256 -notmatch '^[0-9a-fA-F]{64}$') {
        throw "Manifest sourceTreeSha256 is not a SHA-256 digest."
    }
    $currentSourceTreeSha256 = Get-SourceTreeSha256 $repositoryRoot
    Assert-Equal (
        [string]$manifest.sourceTreeSha256
    ) $currentSourceTreeSha256 "Manifest source tree SHA-256"

    if ($RequireCleanSource) {
        if ([bool]$manifest.sourceDirty) {
            throw "Production verification requires manifest sourceDirty=false."
        }
        $gitStatus = @(& git status --porcelain)
        if ($LASTEXITCODE -ne 0) {
            throw "Could not inspect Git worktree state."
        }
        if ($gitStatus.Count -gt 0) {
            throw "Production verification requires a clean current worktree."
        }
    }
    if ($releaseKind -eq "production" -and [bool]$manifest.sourceDirty) {
        throw "A production manifest cannot declare sourceDirty=true."
    }

    $manifestFileNames = @($manifest.files | ForEach-Object { [string]$_.name })
    Assert-SameNames $manifestFileNames $payloadNames "Manifest payload set"

    $seenManifestNames = @{}
    foreach ($record in $manifest.files) {
        $name = [string]$record.name
        if ($seenManifestNames.ContainsKey($name)) {
            throw "Manifest contains duplicate file record '$name'."
        }
        $seenManifestNames[$name] = $true

        $path = Join-Path $resolvedReleaseDirectory $name
        $item = Get-Item -LiteralPath $path
        Assert-Equal ([long]$record.sizeBytes) ([long]$item.Length) "$name size"
        $actualHash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        Assert-Equal ([string]$record.sha256) $actualHash "$name SHA-256"
    }

    $checksumPath = Join-Path $resolvedReleaseDirectory "SHA256SUMS.txt"
    $checksumLines = @(
        Get-Content -LiteralPath $checksumPath -Encoding UTF8 |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
    if ($checksumLines.Count -ne $payloadNames.Count) {
        throw "Checksum file must contain exactly $($payloadNames.Count) non-empty lines."
    }
    $checksumRecords = @{}
    foreach ($line in $checksumLines) {
        if ($line -notmatch '^([0-9a-fA-F]{64})  (.+)$') {
            throw "Invalid SHA256SUMS line: $line"
        }
        $name = $Matches[2]
        if ($checksumRecords.ContainsKey($name)) {
            throw "Checksum file contains duplicate entry '$name'."
        }
        $checksumRecords[$name] = $Matches[1].ToUpperInvariant()
    }
    Assert-SameNames @($checksumRecords.Keys) $payloadNames "Checksum payload set"
    foreach ($record in $manifest.files) {
        Assert-Equal (
            [string]$checksumRecords[[string]$record.name]
        ) (
            [string]$record.sha256
        ) "$($record.name) checksum manifest entry"
    }

    $portablePath = Join-Path $resolvedReleaseDirectory $portableName
    $binaryVersionInfo = (Get-Item -LiteralPath $portablePath).VersionInfo
    foreach ($versionField in @(
        [string]$binaryVersionInfo.ProductVersion,
        [string]$binaryVersionInfo.FileVersion,
        [string]$manifest.binaryProductVersion
    )) {
        if (-not $versionField.StartsWith($technicalVersion, [StringComparison]::Ordinal)) {
            throw "Binary version '$versionField' does not match technical version '$technicalVersion'."
        }
    }

    $sourceLicense = Join-Path $repositoryRoot "crates\dream-builder\installer\LICENSE.txt"
    $sourceRunbook = Join-Path $repositoryRoot "docs\game\release-runbook.md"
    $copyPairs = @(
        @($sourceLicense, (Join-Path $resolvedReleaseDirectory "LICENSE.txt")),
        @($sourceRunbook, (Join-Path $resolvedReleaseDirectory "README-zh-CN.md"))
    )
    foreach ($pair in $copyPairs) {
        $sourceHash = (Get-FileHash -LiteralPath $pair[0] -Algorithm SHA256).Hash
        $copiedHash = (Get-FileHash -LiteralPath $pair[1] -Algorithm SHA256).Hash
        Assert-Equal $copiedHash $sourceHash "Copied release document '$($pair[1])'"
    }

    $executableNames = @($portableName, $installerName)
    $manifestSignatureNames = @(
        $manifest.signatures | ForEach-Object { [string]$_.name }
    )
    Assert-SameNames $manifestSignatureNames $executableNames "Manifest signature set"
    $manifestSignatureRecords = @{}
    foreach ($record in $manifest.signatures) {
        $name = [string]$record.name
        if ($manifestSignatureRecords.ContainsKey($name)) {
            throw "Manifest contains duplicate signature record '$name'."
        }
        $manifestSignatureRecords[$name] = [string]$record.status
    }

    $signatureRows = foreach ($name in $executableNames) {
        $path = Join-Path $resolvedReleaseDirectory $name
        $signature = Get-AuthenticodeSignature -LiteralPath $path
        if ($signature.Status -notin @("Valid", "NotSigned")) {
            throw "$name has an unacceptable Authenticode state: $($signature.Status)."
        }
        Assert-Equal (
            [string]$manifestSignatureRecords[$name]
        ) (
            [string]$signature.Status
        ) "$name manifest signature status"
        if ($RequireSigned -and $signature.Status -ne "Valid") {
            throw "Production verification requires a valid Authenticode signature on $name."
        }
        if ($releaseKind -eq "production" -and $signature.Status -ne "Valid") {
            throw "Production manifest requires a valid Authenticode signature on $name."
        }
        if ($releaseKind -eq "candidate" -and $signature.Status -ne "NotSigned") {
            throw "Candidate manifest requires an explicitly unsigned executable: $name."
        }
        [pscustomobject]@{
            File = $name
            Signature = [string]$signature.Status
        }
    }

    Write-Host ""
    Write-Host "Release verification passed:" -ForegroundColor Green
    Write-Host $resolvedReleaseDirectory
    [pscustomobject]@{
        Product = [string]$manifest.product
        Version = $version
        TechnicalVersion = $technicalVersion
        Platform = [string]$manifest.platform
        ReleaseKind = $releaseKind
        SourceCommit = [string]$manifest.sourceCommit
        SourceDirty = [bool]$manifest.sourceDirty
        SourceTreeSha256 = [string]$manifest.sourceTreeSha256
        Files = $actualDirectoryNames.Count
    } | Format-List
    $signatureRows | Format-Table -AutoSize
} finally {
    Pop-Location
}
