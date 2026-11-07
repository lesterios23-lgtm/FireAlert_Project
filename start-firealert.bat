@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%FireAlert_Backend"
set "FRONTEND=%ROOT%FireAlert_Frontend"

if not exist "%BACKEND%\artisan" (
  echo ERROR: Laravel backend was not found at "%BACKEND%".
  pause
  exit /b 1
)

if not exist "%BACKEND%\vendor\autoload.php" (
  echo ERROR: Backend dependencies are missing. Run composer install in FireAlert_Backend first.
  pause
  exit /b 1
)

if not exist "%FRONTEND%\node_modules\.bin\react-scripts.cmd" (
  echo ERROR: Frontend dependencies are missing. Run npm install in FireAlert_Frontend first.
  pause
  exit /b 1
)

where php >nul 2>nul
if errorlevel 1 (
  echo ERROR: PHP was not found in PATH. Start Laragon or add PHP to PATH.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found in PATH. Install Node.js or add npm to PATH.
  pause
  exit /b 1
)

start "FireAlert Backend - Laravel" /D "%BACKEND%" cmd /k "php artisan serve --host=127.0.0.1 --port=8000"
start "FireAlert Frontend - React" /D "%FRONTEND%" cmd /k "npm.cmd start"

echo.
echo FireAlert is starting:
echo   Frontend: http://localhost:3000
echo   Backend:  http://127.0.0.1:8000
echo.
echo Keep both terminal windows open while using the app.
echo Close those windows to stop the servers.
