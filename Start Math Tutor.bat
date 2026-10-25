@echo off
title Math Tutor Launcher
echo.
echo ==========================================
echo   Math Tutor - Starting Application
echo ==========================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo Error: Please run this from the math-tutor project root directory
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm.cmd install
    if errorlevel 1 (
        echo Failed to install frontend dependencies
        pause
        exit /b 1
    )
)

REM Check if backend dependencies are installed
cd backend
if not exist "__pycache__" (
    echo Installing backend dependencies...
    python -m pip install -q fastapi uvicorn aiosqlite jsonschema pydantic sympy pytest httpx 2>nul
)
cd ..

echo.
echo Starting servers...
echo.

REM Start backend in new window
start "Math Tutor - Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in new window
start "Math Tutor - Frontend (Vite)" cmd /k "cd /d "%~dp0" && npm.cmd run dev"

echo.
echo ==========================================
echo   Both servers starting...
echo ==========================================
echo.
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo API Docs: http://127.0.0.1:8000/docs
echo.
echo Close the server windows to stop the application.
echo This launcher window will close automatically in 5 seconds.
echo.

timeout /t 5 /nobreak >nul