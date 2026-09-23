Add-Type -AssemblyName System.Drawing

$sourcePath = "$PSScriptRoot\..\images\logo.png"
if (-not (Test-Path $sourcePath)) {
    Write-Error "Source image not found: $sourcePath"
    exit 1
}

$srcImage = [System.Drawing.Image]::FromFile($sourcePath)

function Create-SquareIcon {
    param(
        [int]$size,
        [string]$destPath,
        [bool]$isMaskable = $false
    )
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background
    $bgColor = [System.Drawing.Color]::White
    $brush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillRectangle($brush, 0, 0, $size, $size)

    # Padding: for maskable icons, leave safe zone (20% padding)
    # for regular icons, leave 10% padding
    $padRatio = if ($isMaskable) { 0.20 } else { 0.08 }
    $availW = $size * (1 - 2 * $padRatio)
    $availH = $size * (1 - 2 * $padRatio)

    $srcW = $srcImage.Width
    $srcH = $srcImage.Height

    $scale = [Math]::Min($availW / $srcW, $availH / $srcH)
    $destW = [int]($srcW * $scale)
    $destH = [int]($srcH * $scale)

    $destX = [int](($size - $destW) / 2)
    $destY = [int](($size - $destH) / 2)

    $g.DrawImage($srcImage, $destX, $destY, $destW, $destH)
    $g.Dispose()

    # Save as PNG
    if (Test-Path $destPath) { Remove-Item $destPath -Force }
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created icon: $destPath ($size x $size)"
}

Create-SquareIcon -size 192 -destPath "$PSScriptRoot\icon-192.png"
Create-SquareIcon -size 512 -destPath "$PSScriptRoot\icon-512.png"
Create-SquareIcon -size 180 -destPath "$PSScriptRoot\apple-touch-icon.png"
Create-SquareIcon -size 64 -destPath "$PSScriptRoot\favicon-64.png"
Create-SquareIcon -size 32 -destPath "$PSScriptRoot\favicon-32.png"

# Maskable icon versions (safe zone padding for Android adaptive icons)
Create-SquareIcon -size 192 -destPath "$PSScriptRoot\icon-192-maskable.png" -isMaskable $true
Create-SquareIcon -size 512 -destPath "$PSScriptRoot\icon-512-maskable.png" -isMaskable $true

$srcImage.Dispose()
Write-Host "All icons created successfully!"
