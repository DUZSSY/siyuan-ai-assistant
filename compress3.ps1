Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param([string]$InputPath, [string]$OutputPath, [int]$MaxWidth, [int]$MaxHeight, [int]$Quality=50)
    
    $img = [System.Drawing.Image]::FromFile($InputPath)
    
    $ratioW = [double]$MaxWidth / $img.Width
    $ratioH = [double]$MaxHeight / $img.Height
    $ratio = [Math]::Min($ratioW, $ratioH)
    
    $newWidth = if ($ratio -lt 1) { [int]($img.Width * $ratio) } else { $img.Width }
    $newHeight = if ($ratio -lt 1) { [int]($img.Height * $ratio) } else { $img.Height }
    
    $newImg = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($newImg)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Low
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::Low
    $graphics.DrawImage($img, 0, 0, $newWidth, $newHeight)
    
    $jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)
    
    $newImg.Save($OutputPath, $jpegEncoder, $encoderParams)
    
    $graphics.Dispose()
    $newImg.Dispose()
    $img.Dispose()
}

# Compress to meet requirements
Resize-Image -InputPath "E:\workdir\Now_work\working\siyuanplwork2\public\icon.png" -OutputPath "E:\workdir\Now_work\working\siyuanplwork2\icon.png" -MaxWidth 128 -MaxHeight 128 -Quality 50
Resize-Image -InputPath "E:\workdir\Now_work\working\siyuanplwork2\public\preview.png" -OutputPath "E:\workdir\Now_work\working\siyuanplwork2\preview.png" -MaxWidth 800 -MaxHeight 600 -Quality 50

Write-Host "Done"
