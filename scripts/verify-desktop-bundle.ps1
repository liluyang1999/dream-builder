[CmdletBinding()]
param(
    [string]$DistPath = ''
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($DistPath)) {
    $DistPath = Join-Path $PSScriptRoot '..\apps\desktop\dist'
}

$resolvedDistPath = (Resolve-Path -LiteralPath $DistPath).Path
$assetPath = Join-Path $resolvedDistPath 'assets'
$indexPath = Join-Path $resolvedDistPath 'index.html'

if (-not (Test-Path -LiteralPath $assetPath -PathType Container)) {
    throw "Desktop asset directory was not found: $assetPath"
}

if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
    throw "Desktop entry document was not found: $indexPath"
}

$javascriptChunks = @(Get-ChildItem -LiteralPath $assetPath -File -Filter '*.js')

function Get-SingleChunk {
    param(
        [Parameter(Mandatory)]
        [string]$Prefix
    )

    $chunkCandidates = @($javascriptChunks | Where-Object { $_.Name -like "$Prefix-*.js" })
    if ($chunkCandidates.Count -ne 1) {
        throw "Expected exactly one '$Prefix' chunk, found $($chunkCandidates.Count)."
    }

    return $chunkCandidates[0]
}

function Assert-ChunkBudget {
    param(
        [Parameter(Mandatory)]
        [System.IO.FileInfo]$Chunk,
        [Parameter(Mandatory)]
        [long]$MaximumBytes
    )

    if ($Chunk.Length -gt $MaximumBytes) {
        throw "Chunk '$($Chunk.Name)' is $($Chunk.Length) bytes; budget is $MaximumBytes bytes."
    }
}

$sceneChunk = Get-SingleChunk -Prefix 'SceneCanvas'
$engineChunk = Get-SingleChunk -Prefix 'three-engine'
$runtimeChunk = Get-SingleChunk -Prefix 'react-three-runtime'
$effectsChunk = Get-SingleChunk -Prefix 'three-effects'
$exporterChunk = Get-SingleChunk -Prefix 'GLTFExporter'

Assert-ChunkBudget -Chunk $sceneChunk -MaximumBytes 100000
Assert-ChunkBudget -Chunk $engineChunk -MaximumBytes 700000
Assert-ChunkBudget -Chunk $runtimeChunk -MaximumBytes 250000
Assert-ChunkBudget -Chunk $effectsChunk -MaximumBytes 120000
Assert-ChunkBudget -Chunk $exporterChunk -MaximumBytes 80000

$unexpectedLargeChunks = @(
    $javascriptChunks |
        Where-Object {
            $_.Length -gt 500000 -and $_.FullName -ne $engineChunk.FullName
        }
)
if ($unexpectedLargeChunks.Count -gt 0) {
    $chunkSummary = ($unexpectedLargeChunks | ForEach-Object { "$($_.Name)=$($_.Length)" }) -join ', '
    throw "Unexpected JavaScript chunks exceed 500000 bytes: $chunkSummary"
}

$indexHtml = Get-Content -Raw -LiteralPath $indexPath
foreach ($deferredChunkName in @('SceneCanvas', 'three-engine', 'react-three-runtime', 'three-effects')) {
    if ($indexHtml.IndexOf($deferredChunkName, [System.StringComparison]::Ordinal) -ge 0) {
        throw "Desktop entry document eagerly references deferred chunk '$deferredChunkName'."
    }
}

[pscustomobject]@{
    DistPath               = $resolvedDistPath
    SceneBytes             = $sceneChunk.Length
    ThreeEngineBytes       = $engineChunk.Length
    ReactThreeRuntimeBytes = $runtimeChunk.Length
    ThreeEffectsBytes      = $effectsChunk.Length
    GltfExporterBytes      = $exporterChunk.Length
    InitialThreePreloads   = 0
} | ConvertTo-Json

Write-Host 'Desktop bundle verification passed.'
