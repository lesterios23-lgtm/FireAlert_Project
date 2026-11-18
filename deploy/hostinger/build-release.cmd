@echo off
rem ---------------------------------------------------------------------------
rem  FireAlert -> Hostinger release builder (double-click friendly)
rem
rem  Works on any Windows 10/11 without installing PowerShell 7.
rem  It simply calls build-release.ps1 with Windows PowerShell 5.1.
rem
rem  Usage:
rem    build-release.cmd                 normal build
rem    build-release.cmd -Zip            also create the .zip files
rem    build-release.cmd -SkipBuild -Zip reuse the existing React build
rem    build-release.cmd -WithVendor     include vendor/ (plans without SSH)
rem    build-release.cmd -ApiUrl https://api.example.com/api/v1 -Zip
rem                                      API on another host (subdomain setup)
rem ---------------------------------------------------------------------------

setlocal

where powershell >nul 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: Windows PowerShell was not found on this computer.
    echo Run the release steps manually - see deploy\hostinger\README.md
    echo section "Building the release".
    echo.
    pause
    exit /b 1
)

rem Always build relative to the repository root, even when double-clicked.
pushd "%~dp0..\.."

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-release.ps1" %*
set "EXITCODE=%ERRORLEVEL%"

popd

if not "%EXITCODE%"=="0" (
    echo.
    echo The build failed with exit code %EXITCODE%.
    echo Check the messages above, then see the troubleshooting section in
    echo deploy\hostinger\README.md
    echo.
    pause
)

exit /b %EXITCODE%
