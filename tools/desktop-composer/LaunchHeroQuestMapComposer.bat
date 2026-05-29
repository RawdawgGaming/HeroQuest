@echo off
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%HeroQuestMapComposer.ps1" -RepoRoot "%SCRIPT_DIR%..\.."
if errorlevel 1 (
  echo.
  echo Hero Quest Map Composer failed to start.
  echo.
  pause
)
