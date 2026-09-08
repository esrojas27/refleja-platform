@echo off
node "%~dp0scripts\dev.mjs" %*
if errorlevel 1 (
  echo.
  echo El arranque fallo. Revisa el mensaje anterior.
  exit /b 1
)
