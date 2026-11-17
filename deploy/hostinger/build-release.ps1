<#
.SYNOPSIS
    Builds the Hostinger upload folders for FireAlert.

.DESCRIPTION
    Produces:
        release/firealert/     -> upload next to public_html
        release/public_html/   -> upload as the web root (Laravel public + React build)

.PARAMETER Zip
    Also create firealert.zip and public_html.zip for the File Manager.

.PARAMETER WithVendor
    Include vendor/. Needed on plans without SSH (otherwise run
    "composer install --no-dev" on the server).

.EXAMPLE
    pwsh -File deploy/hostinger/build-release.ps1

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File deploy\hostinger\build-release.ps1 -Zip

.EXAMPLE
    pwsh -File deploy/hostinger/build-release.ps1 -Zip -WithVendor
#>
[CmdletBinding()]
param(
    [string]$BackendPath,
    [string]$FrontendPath,
    [string]$OutputPath,
    [switch]$Zip,
    [switch]$WithVendor,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

# Windows PowerShell 5.1 leaves $PSScriptRoot empty inside param() defaults,
# so resolve the default paths here instead.
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }

if (-not $BackendPath)  { $BackendPath  = Join-Path $scriptRoot '..\..\FireAlert_Backend' }
if (-not $FrontendPath) { $FrontendPath = Join-Path $scriptRoot '..\..\FireAlert_Frontend' }
if (-not $OutputPath)   { $OutputPath   = Join-Path (Get-Location) 'release' }

function Invoke-Robocopy {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [string[]]$ExcludeDirs = @(),
        [string[]]$ExcludeFiles = @()
    )

    $roboArgs = @($Source, $Destination, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NC', '/NS', '/NP')
    if ($ExcludeDirs.Count)  { $roboArgs += '/XD'; $roboArgs += $ExcludeDirs }
    if ($ExcludeFiles.Count) { $roboArgs += '/XF'; $roboArgs += $ExcludeFiles }

    & robocopy @roboArgs | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed with code $LASTEXITCODE ($Source -> $Destination)"
    }
}

# ---------------------------------------------------------------- validate ---
$BackendPath  = (Resolve-Path $BackendPath).Path
$FrontendPath = (Resolve-Path $FrontendPath).Path

foreach ($required in @(
    (Join-Path $BackendPath 'artisan'),
    (Join-Path $BackendPath 'public\index.php'),
    (Join-Path $FrontendPath 'package.json')
)) {
    if (-not (Test-Path $required)) { throw "Not found: $required" }
}

Write-Host "Backend : $BackendPath"
Write-Host "Frontend: $FrontendPath"

# ------------------------------------------------------------ build SPA ------
if ($SkipBuild) {
    if (-not (Test-Path (Join-Path $FrontendPath 'build\index.html'))) {
        throw 'No previous build found. Run without -SkipBuild first.'
    }
    Write-Host 'Skipping the frontend build (-SkipBuild).' -ForegroundColor Yellow
} else {
    Push-Location $FrontendPath
    try {
        if (-not (Test-Path 'node_modules')) {
            Write-Host 'Installing frontend dependencies...' -ForegroundColor Cyan
            npm ci
            if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
        }

        Write-Host 'Building the React app...' -ForegroundColor Cyan
        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }
    }
    finally {
        Pop-Location
    }
}

# -------------------------------------------------------------- staging ------
$releaseRoot = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
    $OutputPath
} else {
    Join-Path (Get-Location) $OutputPath
}
$appDir      = Join-Path $releaseRoot 'firealert'
$webDir      = Join-Path $releaseRoot 'public_html'

if (Test-Path $releaseRoot) { Remove-Item $releaseRoot -Recurse -Force }
New-Item -ItemType Directory -Path $appDir, $webDir -Force | Out-Null

Write-Host "Staging the backend..." -ForegroundColor Cyan

$backendExcludeDirs = @(
    (Join-Path $BackendPath 'node_modules'),
    (Join-Path $BackendPath '.git'),
    (Join-Path $BackendPath '.claude'),
    (Join-Path $BackendPath '.scribe'),
    (Join-Path $BackendPath 'tests'),
    (Join-Path $BackendPath 'database\backups'),
    (Join-Path $BackendPath 'storage\logs'),
    (Join-Path $BackendPath 'storage\framework\cache'),
    (Join-Path $BackendPath 'storage\framework\sessions'),
    (Join-Path $BackendPath 'storage\framework\views'),
    # Stale manifests list dev-only providers (Scribe, Boost, Pail, Pest).
    # Copying them breaks a --no-dev install with "class not found".
    (Join-Path $BackendPath 'bootstrap\cache')
)
if (-not $WithVendor) { $backendExcludeDirs += (Join-Path $BackendPath 'vendor') }

Invoke-Robocopy -Source $BackendPath -Destination $appDir `
    -ExcludeDirs $backendExcludeDirs `
    -ExcludeFiles @('.env', '.env.backup', '.env.production', '.phpunit.result.cache')

# Laravel needs these folders to exist and be writable.
foreach ($dir in @(
    'storage\logs',
    'storage\framework\cache',
    'storage\framework\sessions',
    'storage\framework\views',
    'storage\app\public',
    'storage\app\private',
    'bootstrap\cache'
)) {
    New-Item -ItemType Directory -Path (Join-Path $appDir $dir) -Force | Out-Null
}

Write-Host "Staging the web root..." -ForegroundColor Cyan

Invoke-Robocopy -Source (Join-Path $BackendPath 'public') -Destination $webDir `
    -ExcludeDirs @(
        (Join-Path $BackendPath 'public\storage'),
        (Join-Path $BackendPath 'public\vendor')
    ) `
    -ExcludeFiles @('index.php', '.htaccess')

Invoke-Robocopy -Source (Join-Path $FrontendPath 'build') -Destination $webDir

# The Hostinger front controller and rewrite rules replace Laravel's defaults.
Copy-Item (Join-Path $scriptRoot 'public_html\index.php')  (Join-Path $webDir 'index.php')  -Force
Copy-Item (Join-Path $scriptRoot 'public_html\.htaccess')  (Join-Path $webDir '.htaccess')  -Force

# ---------------------------------------------------------------- report -----
function Get-FolderSizeMb {
    param([string]$Path)
    $bytes = (Get-ChildItem $Path -Recurse -File -Force | Measure-Object -Property Length -Sum).Sum
    if (-not $bytes) { return 0 }
    [math]::Round($bytes / 1MB, 1)
}

Write-Host ''
Write-Host 'Release ready:' -ForegroundColor Green
Write-Host ("  {0}  ({1} MB)" -f $appDir, (Get-FolderSizeMb $appDir))
Write-Host ("  {0}  ({1} MB)" -f $webDir, (Get-FolderSizeMb $webDir))

if (-not $WithVendor) {
    Write-Host ''
    Write-Host 'vendor/ was excluded. Run on the server:' -ForegroundColor Yellow
    Write-Host '  composer install --no-dev --optimize-autoloader' -ForegroundColor Yellow
    Write-Host 'or re-run this script with -WithVendor.' -ForegroundColor Yellow
}

if ($Zip) {
    Write-Host ''
    Write-Host 'Creating ZIP archives...' -ForegroundColor Cyan

    foreach ($name in @('firealert', 'public_html')) {
        $archive = Join-Path $releaseRoot "$name.zip"
        if (Test-Path $archive) { Remove-Item $archive -Force }

        # Use Windows' bsdtar explicitly: the tar that ships with Git cannot
        # handle "C:\..." paths (it treats the drive letter as a remote host).
        $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
        if (-not (Test-Path $tar)) { $tar = 'tar.exe' }

        & $tar -a -c -f $archive -C $releaseRoot $name
        if ($LASTEXITCODE -ne 0) { throw "tar failed for $name" }

        Write-Host ("  {0}  ({1} MB)" -f $archive, [math]::Round((Get-Item $archive).Length / 1MB, 1))
    }
}
