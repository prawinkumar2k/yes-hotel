Add-Type -AssemblyName System.Drawing
$baseDir = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $baseDir "public\brand\icon-192.png"

if (Test-Path $srcPath) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    foreach ($sz in @(48, 96)) {
        $dest = New-Object System.Drawing.Bitmap $sz, $sz
        $g = [System.Drawing.Graphics]::FromImage($dest)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($src, 0, 0, $sz, $sz)
        $outPath = Join-Path $baseDir "public\favicon-$sz.png"
        $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose()
        $dest.Dispose()
        Write-Host "Created $outPath"
    }
    $src.Dispose()
} else {
    Write-Error "Source image not found: $srcPath"
}
