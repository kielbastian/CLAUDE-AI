@echo off
title Instalacja Kalkulator CNC
echo === Instalator aplikacji Kalkulator CNC ===
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
