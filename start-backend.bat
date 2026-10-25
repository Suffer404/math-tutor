@echo off
REM ---------------------------------------------------------------------------
REM Math Tutor - backend only (use this while debugging the API / .env).
REM Runs in this window so you can read the traceback. Ctrl+C to stop.
REM Must run from the repo root: uvicorn imports "backend.main:app".
REM ---------------------------------------------------------------------------
setlocal
pushd "%~dp0"

echo Backend: http://127.0.0.1:8000   docs: http://127.0.0.1:8000/docs
echo Close this window (or Ctrl+C) to stop.
echo.

python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

echo.
echo Backend stopped. If the line above shows a traceback, read it - it is the real error.
popd
endlocal
pause
