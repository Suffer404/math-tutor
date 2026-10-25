@echo off
REM ---------------------------------------------------------------------------
REM Math Tutor - development launcher
REM Starts the FastAPI backend FROM THE REPO ROOT (backend.main:app) and then Vite.
REM Do not run uvicorn with "main:app" from inside backend\ - relative imports fail.
REM ---------------------------------------------------------------------------
setlocal
pushd "%~dp0"

echo Starting backend on http://127.0.0.1:8000 ...
start "Math Tutor Backend" cmd /k python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

timeout /t 2 /nobreak >nul

echo Starting frontend on http://localhost:5173 ...
start "Math Tutor Frontend" cmd /k npm.cmd run dev

popd
endlocal

echo.
echo   API docs : http://127.0.0.1:8000/docs
echo   App      : http://localhost:5173
echo.
echo Two windows were opened. Close them to stop the servers.
pause
