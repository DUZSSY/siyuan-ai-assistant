Add-Type -AssemblyName System.Drawing

$icon = [System.Drawing.Image]::FromFile("E:\workdir\Now_work\working\siyuanplwork2\public\icon.png")
$icon.Save("E:\workdir\Now_work\working\siyuanplwork2\icon.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$icon.Dispose()

$preview = [System.Drawing.Image]::FromFile("E:\workdir\Now_work\working\siyuanplwork2\public\preview.png")
$preview.Save("E:\workdir\Now_work\working\siyuanplwork2\preview.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$preview.Dispose()

Write-Host "icon.jpg size:" (Get-Item "E:\workdir\Now_work\working\siyuanplwork2\icon.jpg").Length / 1KB "KB"
Write-Host "preview.jpg size:" (Get-Item "E:\workdir\Now_work\working\siyuanplwork2\preview.jpg").Length / 1KB "KB"
