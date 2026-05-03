@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo.
echo ===========================================
echo   RESTAURANT MANAGEMENT - QUICK START
echo ===========================================
echo.

where npm >NUL 2>&1
if ERRORLEVEL 1 (
  echo ERROR: npm is not available on PATH.
  echo Install Node.js, then run this script again.
  exit /b 1
)

if not exist "%BACKEND%\package.json" (
  echo ERROR: Backend folder not found at "%BACKEND%".
  exit /b 1
)

if not exist "%FRONTEND%\package.json" (
  echo ERROR: Frontend folder not found at "%FRONTEND%".
  exit /b 1
)

echo Step 1: Checking dependencies...
set "NEED_BACKEND_INSTALL=0"
set "NEED_FRONTEND_INSTALL=0"

if not exist "%BACKEND%\node_modules" set "NEED_BACKEND_INSTALL=1"
if not exist "%BACKEND%\node_modules\express\package.json" set "NEED_BACKEND_INSTALL=1"

if not exist "%FRONTEND%\node_modules" set "NEED_FRONTEND_INSTALL=1"
if not exist "%FRONTEND%\node_modules\react-scripts\package.json" set "NEED_FRONTEND_INSTALL=1"
if not exist "%FRONTEND%\node_modules\cross-env\package.json" set "NEED_FRONTEND_INSTALL=1"
if not exist "%FRONTEND%\node_modules\.bin\cross-env.cmd" set "NEED_FRONTEND_INSTALL=1"

if "%NEED_BACKEND_INSTALL%"=="1" (
  echo Installing backend dependencies...
  pushd "%BACKEND%"
  call npm install --include=dev
  if ERRORLEVEL 1 (
    popd
    echo ERROR: Failed to install backend dependencies.
    exit /b 1
  )
  popd
)

if "%NEED_FRONTEND_INSTALL%"=="1" (
  echo Installing frontend dependencies...
  pushd "%FRONTEND%"
  call npm install --include=dev
  if ERRORLEVEL 1 (
    popd
    echo ERROR: Failed to install frontend dependencies.
    exit /b 1
  )
  popd
)

if "%NEED_BACKEND_INSTALL%"=="0" if "%NEED_FRONTEND_INSTALL%"=="0" (
  echo Dependencies already installed.
)

echo.
echo Step 2: Starting backend and frontend...
start "Restaurant Backend" cmd /k "cd /d ""%BACKEND%"" && npm start"
start "Restaurant Frontend" cmd /k "cd /d ""%FRONTEND%"" && npm run start"

echo.
echo Started successfully:
echo   Backend:  http://localhost:3000
echo   Frontend: http://localhost:3001
echo.
echo Two terminals were opened. Close them to stop the app.

exit /b 0
