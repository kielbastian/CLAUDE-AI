# Instalator aplikacji Kalkulator CNC
$src  = $PSScriptRoot
$dest = "$env:LOCALAPPDATA\KalkulatorCNC"

Write-Host "Instaluje Kalkulator CNC do: $dest"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

if (-not (Test-Path "$src\kalkulator_cnc.html")) {
  Write-Host "BLAD: brak pliku kalkulator_cnc.html obok instalatora." -ForegroundColor Red
  return
}
Copy-Item "$src\kalkulator_cnc.html" $dest -Force
if (Test-Path "$src\Kalkulator-CNC.ico") { Copy-Item "$src\Kalkulator-CNC.ico" $dest -Force }

# launcher uruchamiajacy aplikacje w osobnym oknie (bez paska adresu, bez konsoli)
$vbs = @'
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
html = base & "\kalkulator_cnc.html"
url = "file:///" & Replace(html, "\", "/")
Set sh = CreateObject("WScript.Shell")
On Error Resume Next
sh.Run "msedge --app=""" & url & """ --window-size=1120,840", 1, False
If Err.Number <> 0 Then
  Err.Clear
  sh.Run "chrome --app=""" & url & """ --window-size=1120,840", 1, False
End If
If Err.Number <> 0 Then sh.Run """" & html & """", 1, False
'@
Set-Content -Path "$dest\start.vbs" -Value $vbs -Encoding ASCII

$ico    = "$dest\Kalkulator-CNC.ico"
$target = "$env:WINDIR\System32\wscript.exe"
$arg    = "`"$dest\start.vbs`""

$ws = New-Object -ComObject WScript.Shell
$places = @([Environment]::GetFolderPath('Desktop'),
            "$env:APPDATA\Microsoft\Windows\Start Menu\Programs")
foreach ($dir in $places) {
  $lnk = $ws.CreateShortcut((Join-Path $dir "Kalkulator CNC.lnk"))
  $lnk.TargetPath       = $target
  $lnk.Arguments        = $arg
  $lnk.WorkingDirectory = $dest
  $lnk.Description       = "Kalkulator CNC"
  if (Test-Path $ico) { $lnk.IconLocation = $ico }
  $lnk.Save()
}

Write-Host ""
Write-Host "Gotowe! Skrot 'Kalkulator CNC' jest na pulpicie i w menu Start." -ForegroundColor Green
Write-Host "Mozesz go przeciagnac/przypiac do paska zadan."
