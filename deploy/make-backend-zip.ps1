# Builds deploy\backend.zip for the cPanel File Manager, leaving out secrets
# and local-only files. Upload it to public_html and extract it there (it
# creates/updates public_html/backend), then delete the zip on the server.
#
# Usage, from the project root:
#   powershell -ExecutionPolicy Bypass -File deploy\make-backend-zip.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$backend = Join-Path (Split-Path -Parent $PSScriptRoot) 'backend'
$zip = Join-Path $PSScriptRoot 'backend.zip'
if (Test-Path $zip) {
    try { Remove-Item $zip } catch { throw "Close $zip in any open program (Explorer preview, 7-Zip, upload) and run again." }
}

# Paths relative to backend/, left out of the zip.
$skip = @(
    # Server settings live in /home/<user>/carelink.env, never in the upload.
    '^\.env(\..+)?$'
    # Config/route caches hold this machine's (XAMPP) paths and settings.
    '^bootstrap/cache/.+\.php$'
    # Local logs, sessions, compiled views and test uploads.
    '^storage/(logs|framework/(cache|sessions|testing|views)|app/public)/.+'
    # Windows symlink; not needed now that avatars are served by the API.
    '^public/storage(/|$)'
    # Development-only files.
    '^(tests|node_modules)/'
    '^\.phpunit\.result\.cache$'
    '^postgres-audit\.txt$'
)
$keepEnv = '^\.env\.example$'

# Created empty so a fresh extract has every folder Laravel writes to.
$emptyFolders = @(
    'storage/logs/', 'storage/framework/cache/data/', 'storage/framework/sessions/',
    'storage/framework/views/', 'storage/app/public/', 'bootstrap/cache/'
)

$archive = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
$count = 0
try {
    foreach ($folder in $emptyFolders) { [void]$archive.CreateEntry("backend/$folder") }

    Get-ChildItem -LiteralPath $backend -Recurse -File -Force | ForEach-Object {
        $relative = $_.FullName.Substring($backend.Length + 1).Replace('\', '/')
        if ($relative -notmatch $keepEnv) {
            foreach ($pattern in $skip) { if ($relative -match $pattern) { return } }
        }
        # Forward slashes: cPanel's extractor treats backslashes as part of the name.
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive, $_.FullName, "backend/$relative", 'Optimal')
        $count++
    }
} finally {
    $archive.Dispose()
}

$size = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Host "Created $zip ($count files, $size MB) without .env or cached config."
