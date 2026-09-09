@echo off
node "%~dp0scripts\bootstrap-operator.mjs" %*
exit /b %errorlevel%
