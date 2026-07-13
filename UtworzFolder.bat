@echo off
rem ============================================================
rem  UtworzFolder - przeciagnij plik .txt / .nc na ten plik,
rem  a program utworzy folder o nazwie z nawiasu w pierwszej
rem  linijce pliku, np. O02316 (TRZPIEN UA 227113)
rem  -> folder "TRZPIEN UA 227113" obok pliku.
rem ============================================================

if "%~1"=="" (
    echo.
    echo  Przeciagnij plik tekstowy ^(.txt lub .nc^) na ikone tego pliku,
    echo  a program utworzy folder o nazwie z nawiasu w pierwszej linijce.
    echo.
    pause
    exit /b 0
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0UtworzFolder.ps1" %*

echo.
pause
