param(
    [switch]$AllowDirty,
    [switch]$SkipQualityGate,
    [switch]$RequireSigned,
    [string]$CertificateThumbprint = $env:DREAM_BUILDER_CERTIFICATE_THUMBPRINT,
    [string]$TimestampUrl = $env:DREAM_BUILDER_TIMESTAMP_URL,
    [string]$OutputDirectory = "output\release"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$temporarySigningDirectory = $null
. (Join-Path $PSScriptRoot "lib\version-contract.ps1")
Push-Location $repositoryRoot

try {
    function Invoke-CheckedCommand {
        param(
            [Parameter(Mandatory = $true)]
            [string]$Label,
            [Parameter(Mandatory = $true)]
            [string]$Executable,
            [Parameter(Mandatory = $true)]
            [string[]]$Arguments
        )

        Write-Host ""
        Write-Host "==> $Label" -ForegroundColor Cyan
        & $Executable @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Label failed with exit code $LASTEXITCODE."
        }
    }

    function Read-JsonFile {
        param([Parameter(Mandatory = $true)][string]$Path)
        return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
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
    $productVersion = $versionContract.ProductVersion
    $toolingVersion = $versionContract.ToolingVersion
    $tauriConfig = $versionContract.TauriConfig
    $capabilityConfig = Read-JsonFile (
        Join-Path $repositoryRoot "crates\dream-builder\capabilities\default.json"
    )

    $permissionIdentifiers = @(
        $capabilityConfig.permissions | ForEach-Object {
            if ($_ -is [string]) { $_ } else { [string]$_.identifier }
        }
    )
    if ($permissionIdentifiers -notcontains "core:window:allow-close") {
        throw "The release capability must allow the in-game safe-exit action."
    }

    if (-not $RequireSigned -and (
        -not [string]::IsNullOrWhiteSpace($CertificateThumbprint) -or
        -not [string]::IsNullOrWhiteSpace($TimestampUrl)
    )) {
        throw "Signing inputs were provided without -RequireSigned."
    }
    if ($RequireSigned) {
        if ($AllowDirty) {
            throw "A signed production build cannot use -AllowDirty."
        }
        if ($SkipQualityGate) {
            throw "A signed production build cannot use -SkipQualityGate."
        }
        if ([string]::IsNullOrWhiteSpace($CertificateThumbprint)) {
            throw "DREAM_BUILDER_CERTIFICATE_THUMBPRINT is required for a signed build."
        }
        if ([string]::IsNullOrWhiteSpace($TimestampUrl)) {
            throw "DREAM_BUILDER_TIMESTAMP_URL is required for a signed build."
        }

        $CertificateThumbprint = ($CertificateThumbprint -replace '\s', '').ToUpperInvariant()
        if ($CertificateThumbprint -notmatch '^[0-9A-F]{40}$') {
            throw "The code-signing certificate thumbprint must contain 40 hexadecimal characters."
        }
        $timestampUri = $null
        if (-not [Uri]::TryCreate(
            $TimestampUrl,
            [UriKind]::Absolute,
            [ref]$timestampUri
        ) -or $timestampUri.Scheme -notin @("http", "https")) {
            throw "The timestamp URL must be an absolute HTTP or HTTPS URL."
        }

        $certificate = Get-Item -LiteralPath (
            "Cert:\CurrentUser\My\$CertificateThumbprint"
        ) -ErrorAction SilentlyContinue
        if ($null -eq $certificate) {
            throw "The requested code-signing certificate is not installed in Cert:\CurrentUser\My."
        }
        if (-not $certificate.HasPrivateKey) {
            throw "The requested code-signing certificate has no accessible private key."
        }
        if ($certificate.NotBefore -gt (Get-Date) -or $certificate.NotAfter -le (Get-Date)) {
            throw "The requested code-signing certificate is not currently valid."
        }
        $enhancedKeyUsageIds = @(
            $certificate.EnhancedKeyUsageList |
                ForEach-Object { $_.ObjectId.Value }
        )
        if ($enhancedKeyUsageIds -notcontains "1.3.6.1.5.5.7.3.3") {
            throw "The requested certificate is not valid for code signing."
        }
    }

    $gitStatus = @(& git status --porcelain)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect Git worktree state."
    }
    $sourceDirty = $gitStatus.Count -gt 0
    if ($sourceDirty -and -not $AllowDirty) {
        throw "The worktree is dirty. Commit the intended release state or rerun with -AllowDirty for a local candidate."
    }
    $sourceCommit = (& git rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Could not resolve the source commit."
    }
    $sourceTreeSha256 = Get-SourceTreeSha256 $repositoryRoot

    if (-not $SkipQualityGate) {
        Invoke-CheckedCommand "Frontend quality gate" "pnpm" @("check")
        Invoke-CheckedCommand "Rust formatting" "cargo" @("fmt", "--check")
        Invoke-CheckedCommand "Rust tests" "cargo" @("test", "--workspace", "--locked")
        Invoke-CheckedCommand "Rust Clippy" "cargo" @(
            "clippy",
            "--workspace",
            "--all-targets",
            "--locked",
            "--",
            "-D",
            "warnings"
        )
    }

    $tauriArguments = @("tauri", "build")
    if ($RequireSigned) {
        $temporarySigningDirectory = Join-Path (
            [IO.Path]::GetTempPath()
        ) ("dream-builder-signing-" + [Guid]::NewGuid().ToString("N"))
        New-Item -ItemType Directory -Path $temporarySigningDirectory | Out-Null
        $signingConfigPath = Join-Path $temporarySigningDirectory "tauri.signing.json"
        $signingConfig = [ordered]@{
            bundle = [ordered]@{
                windows = [ordered]@{
                    certificateThumbprint = $CertificateThumbprint
                    digestAlgorithm = "sha256"
                    timestampUrl = $TimestampUrl
                }
            }
        }
        $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
        [IO.File]::WriteAllText(
            $signingConfigPath,
            ($signingConfig | ConvertTo-Json -Depth 5),
            $utf8WithoutBom
        )
        $tauriArguments += @("--config", $signingConfigPath)
    }
    Invoke-CheckedCommand "Tauri Windows bundle" "pnpm" $tauriArguments

    $binaryPath = Join-Path $repositoryRoot "target\release\dream-builder.exe"
    if (-not (Test-Path -LiteralPath $binaryPath -PathType Leaf)) {
        throw "Tauri build did not produce $binaryPath."
    }

    $installerDirectory = Join-Path $repositoryRoot "target\release\bundle\nsis"
    $installerCandidates = @(
        Get-ChildItem -LiteralPath $installerDirectory -Filter "*_$($toolingVersion)_x64-setup.exe" -File
    )
    if ($installerCandidates.Count -ne 1) {
        throw "Expected exactly one NSIS installer for the current tooling version; found $($installerCandidates.Count)."
    }
    $installerPath = $installerCandidates[0].FullName

    foreach ($versionedExecutable in @($binaryPath, $installerPath)) {
        $versionInfo = (Get-Item -LiteralPath $versionedExecutable).VersionInfo
        foreach ($binaryVersion in @(
            [string]$versionInfo.ProductVersion,
            [string]$versionInfo.FileVersion
        )) {
            if ($binaryVersion.Trim() -ne $productVersion) {
                throw "Player-visible version '$binaryVersion' in '$versionedExecutable' does not match product version '$productVersion'."
            }
        }
    }

    $resolvedOutputRoot = if ([IO.Path]::IsPathRooted($OutputDirectory)) {
        [IO.Path]::GetFullPath($OutputDirectory)
    } else {
        [IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputDirectory))
    }
    $releaseDirectory = Join-Path $resolvedOutputRoot $productVersion
    New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null

    $portableOutput = Join-Path $releaseDirectory "Dream-Builder-Fantasy-Tree_${productVersion}_x64.exe"
    $installerOutput = Join-Path $releaseDirectory "Dream-Builder-Fantasy-Tree_${productVersion}_x64-setup.exe"
    $licenseOutput = Join-Path $releaseDirectory "LICENSE.txt"
    $runbookOutput = Join-Path $releaseDirectory "README-zh-CN.md"

    Copy-Item -LiteralPath $binaryPath -Destination $portableOutput -Force
    Copy-Item -LiteralPath $installerPath -Destination $installerOutput -Force
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "crates\dream-builder\installer\LICENSE.txt") -Destination $licenseOutput -Force
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "docs\game\release-runbook.md") -Destination $runbookOutput -Force

    $deliverables = @($portableOutput, $installerOutput, $licenseOutput, $runbookOutput)
    $fileRecords = foreach ($path in $deliverables) {
        $item = Get-Item -LiteralPath $path
        $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        [ordered]@{
            name = $item.Name
            sizeBytes = $item.Length
            sha256 = $hash
        }
    }

    $signatureRecords = foreach ($path in @($portableOutput, $installerOutput)) {
        $signature = Get-AuthenticodeSignature -LiteralPath $path
        if ($RequireSigned -and $signature.Status -ne "Valid") {
            throw "Signed production build has invalid Authenticode state for '$path': $($signature.Status)."
        }
        if (-not $RequireSigned -and $signature.Status -ne "NotSigned") {
            throw "Unsigned candidate build unexpectedly produced signature state '$($signature.Status)' for '$path'."
        }
        [ordered]@{
            name = [IO.Path]::GetFileName($path)
            status = [string]$signature.Status
        }
    }

    $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
    $checksumPath = Join-Path $releaseDirectory "SHA256SUMS.txt"
    $checksumLines = @(
        $fileRecords | ForEach-Object { "$($_.sha256)  $($_.name)" }
    )
    [IO.File]::WriteAllLines($checksumPath, $checksumLines, $utf8WithoutBom)

    $manifest = [ordered]@{
        schemaVersion = 5
        product = [string]$tauriConfig.productName
        version = $productVersion
        platform = "windows-x64"
        releaseKind = if ($RequireSigned) { "production" } else { "candidate" }
        generatedAtUtc = [DateTime]::UtcNow.ToString("o")
        sourceCommit = $sourceCommit
        sourceDirty = $sourceDirty
        sourceTreeSha256 = $sourceTreeSha256
        signatures = $signatureRecords
        files = $fileRecords
    }
    $manifestPath = Join-Path $releaseDirectory "release-manifest.json"
    [IO.File]::WriteAllText(
        $manifestPath,
        ($manifest | ConvertTo-Json -Depth 6),
        $utf8WithoutBom
    )

    $verificationArguments = @(
        "-NoLogo",
        "-NoProfile",
        "-File",
        (Join-Path $repositoryRoot "scripts\release-verify.ps1"),
        "-ReleaseDirectory",
        $releaseDirectory
    )
    if ($RequireSigned) {
        $verificationArguments += @("-RequireCleanSource", "-RequireSigned")
    }
    Invoke-CheckedCommand "Release artifact verification" "powershell" $verificationArguments

    Write-Host ""
    $releaseLabel = if ($RequireSigned) {
        "Signed production release assembled:"
    } else {
        "Unsigned release candidate assembled:"
    }
    Write-Host $releaseLabel -ForegroundColor Green
    Write-Host $releaseDirectory
    Get-ChildItem -LiteralPath $releaseDirectory -File |
        Sort-Object Name |
        Select-Object Name, Length |
        Format-Table -AutoSize
} finally {
    if ($null -ne $temporarySigningDirectory -and (
        Test-Path -LiteralPath $temporarySigningDirectory -PathType Container
    )) {
        $resolvedTemporarySigningDirectory = [IO.Path]::GetFullPath(
            $temporarySigningDirectory
        )
        $resolvedSystemTempRoot = (
            [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\")
        ) + "\"
        if ($resolvedTemporarySigningDirectory.StartsWith(
            $resolvedSystemTempRoot,
            [StringComparison]::OrdinalIgnoreCase
        )) {
            Remove-Item -LiteralPath $resolvedTemporarySigningDirectory -Recurse -Force
        }
    }
    Pop-Location
}
