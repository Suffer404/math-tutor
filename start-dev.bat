@echo off
REM start-dev.bat - Start both frontend and backend in development mode

echo Starting Math Tutor Development Environment
echo ===========================================

REM Check if backend is already running
curl -s http://127.0.0.1:8000/docs >nul 2>&1
if %errorlevel% equ 0 (
    echo Backend already running on http://127.0.0.1:8000
) else (
    echo Starting backend...
    start "Math Tutor Backend" cmd /k "cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"
    timeout /t 3 /nobreak >nul
)

echo Starting frontend...
start "Math Tutor Frontend" cmd /k "npm.cmd run dev"

echo.
echo Frontend: http://localhost:5173
echo Backend API: http://127.0.0.1:8000
echo API Docs: http://127.0.0.1:8000/docs
echo.
echo Press any key to close this window (servers will keep running)
pause