Add-Type -AssemblyName System.Drawing

function Compress-Image {
    param([string]$InputPath, [string]$OutputPath, [int]$MaxWidth, [int]$MaxHeight, [int]$Quality=75)
    
    $img = [System.Drawing.Image]::FromFile($InputPath)
    $width = $img.Width
    $height = $img.Height
    
    # Calculate new dimensions
    $ratioW = [double]$MaxWidth / $width
    $ratioH = [double]$MaxHeight / $height
    $ratio = [Math]::Min($ratioW, $ratioH)
    
    if ($ratio -lt 1) {
        $newWidth = [int]($width * $ratio)
        $newHeight = [int]($height * $ratio)
    } else {
        $newWidth = $width
        $newHeight = $height
    }
    
    $newImg = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($newImg)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($img, 0, 0, $newWidth, $newHeight)
    
    # Save with quality setting
    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/png' }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)
    
    $newImg.Save($OutputPath, $encoder, $encoderParams)
    
    $graphics.Dispose()
    $newImg.Dispose()
    $img.Dispose()
}

# Compress icon.png (max 160x160)
Compress-Image -InputPath "E:\workdir\Now_work\working\siyuanplwork2\public\icon.png" -OutputPath "E:\workdir\Now_work\working\siyuanplwork2\icon.png" -MaxWidth 160 -MaxHeight 160 -Quality 80

# Compress preview.png (max 1024x768)
Compress-Image -InputPath "E:\workdir\Now_work\working\siyuanplwork2\public\preview.png" -OutputPath "E:\workdir\Now_work\working\siyuanplwork2\preview.png" -MaxWidth 1024 -MaxHeight 768 -Quality 80

Write-Host "Done"
