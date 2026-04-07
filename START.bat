@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "PSQL=C:\Program Files\PostgreSQL\17\bin\psql.exe"
set "CREATEDB=C:\Program Files\PostgreSQL\17\bin\createdb.exe"

echo.
echo ===========================================
echo   RESTAURANT MANAGEMENT APP - STARTUP
echo ===========================================
echo.

echo Step 1: Checking PostgreSQL...
tasklist /FI "IMAGENAME eq postgres.exe" 2>NUL | find /I "postgres.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo OK: PostgreSQL is running.
) else (
    net start PostgreSQL-x64-17 >NUL 2>&1
    timeout /t 3 /nobreak >NUL
    tasklist /FI "IMAGENAME eq postgres.exe" 2>NUL | find /I "postgres.exe" >NUL
    if NOT "%ERRORLEVEL%"=="0" (
        echo ERROR: PostgreSQL is not running. Start it, then run START.bat again.
        exit /b 1
    )
    echo OK: PostgreSQL started.
)

if not exist "%PSQL%" (
    echo ERROR: psql not found at %PSQL%
    exit /b 1
)

if not exist "%CREATEDB%" (
    echo ERROR: createdb not found at %CREATEDB%
    exit /b 1
)

echo.
echo Step 2: Ensuring database and schema...
cd /d "%BACKEND%"
set "PGPASSWORD=postgres"
"%CREATEDB%" -U postgres restaurant_db >NUL 2>&1
"%PSQL%" -U postgres -d restaurant_db -f "%BACKEND%\schema.sql" >NUL 2>&1
if ERRORLEVEL 1 (
    echo ERROR: Failed to apply schema.sql
    exit /b 1
)

call node init-db.js
if ERRORLEVEL 1 (
    echo ERROR: Failed to initialize users.
    exit /b 1
)
echo OK: Database ready.

echo.
echo Step 3: Starting backend server...
start "Restaurant Backend" cmd /k "cd /d "%BACKEND%" && npm start"
timeout /t 4 /nobreak >NUL

echo.
echo App URL: http://localhost:3000
echo Test users (password: password123):
echo   owner@restaurant.com
echo   manager@restaurant.com
echo   waiter@restaurant.com
echo   kitchen@restaurant.com
echo.

start http://localhost:3000
