@echo off
title Odinstaluj Kalkulator CNC
echo Usuwanie aplikacji Kalkulator CNC...
del "%USERPROFILE%\Desktop\Kalkulator CNC.lnk" 2>nul
del "%OneDrive%\Desktop\Kalkulator CNC.lnk" 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Kalkulator CNC.lnk" 2>nul
rmdir /S /Q "%LOCALAPPDATA%\KalkulatorCNC" 2>nul
echo Usunieto skroty i pliki aplikacji.
echo.
pause
