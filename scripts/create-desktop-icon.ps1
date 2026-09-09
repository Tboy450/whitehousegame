param([string]$SourcePath = (Join-Path $PSScriptRoot '..\assets\desktop\rocket-run.png'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourcePath).Path)
$frames = [System.Collections.Generic.List[byte[]]]::new()
$sizes = @(16, 24, 32, 48, 64, 128, 256)
try {
    foreach ($size in $sizes) {
        $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $stream = [System.IO.MemoryStream]::new()
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($source, [System.Drawing.Rectangle]::new(0, 0, $size, $size))
            if ($size -eq 256) {
                $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
            } else {
                # Classic Windows DIB frames work with Explorer and older icon readers.
                # ICO bitmap height includes both the color image and transparency mask.
                $frameWriter = [System.IO.BinaryWriter]::new($stream, [Text.Encoding]::UTF8, $true)
                try {
                    $frameWriter.Write([uint32]40)
                    $frameWriter.Write([int32]$size); $frameWriter.Write([int32]($size * 2))
                    $frameWriter.Write([uint16]1); $frameWriter.Write([uint16]32)
                    $frameWriter.Write([uint32]0); $frameWriter.Write([uint32]($size * $size * 4))
                    for ($field = 0; $field -lt 4; $field++) { $frameWriter.Write([uint32]0) }
                    for ($y = $size - 1; $y -ge 0; $y--) {
                        for ($x = 0; $x -lt $size; $x++) {
                            $pixel = $bitmap.GetPixel($x, $y)
                            $frameWriter.Write([byte]$pixel.B); $frameWriter.Write([byte]$pixel.G)
                            $frameWriter.Write([byte]$pixel.R); $frameWriter.Write([byte]$pixel.A)
                        }
                    }
                    $maskStride = [int]([Math]::Ceiling($size / 32.0) * 4)
                    for ($y = $size - 1; $y -ge 0; $y--) {
                        $mask = [byte[]]::new($maskStride)
                        for ($x = 0; $x -lt $size; $x++) {
                            if ($bitmap.GetPixel($x, $y).A -eq 0) {
                                $index = [int][Math]::Floor($x / 8.0)
                                $mask[$index] = $mask[$index] -bor (128 -shr ($x % 8))
                            }
                        }
                        $frameWriter.Write($mask)
                    }
                } finally { $frameWriter.Dispose() }
            }
            $frames.Add($stream.ToArray())
        } finally { $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
    }
} finally { $source.Dispose() }
$outPath = Join-Path (Split-Path -Parent (Resolve-Path -LiteralPath $SourcePath).Path) 'rocket-run.ico'
$file = [System.IO.File]::Create($outPath)
$writer = [System.IO.BinaryWriter]::new($file)
try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $dimension = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
        $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
        $offset += $frames[$i].Length
    }
    foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
} finally { $writer.Dispose(); $file.Dispose() }
Write-Output "Created Windows icon: $outPath (16, 24, 32, 48, 64, 128 and 256 pixels)"
