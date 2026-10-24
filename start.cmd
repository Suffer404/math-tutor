@echo off
REM Wrapper for start.ps1 so it runs even when PowerShell blocks scripts.
REM Usage:  start.cmd            (Claude Code, Phase 0)
REM         start.cmd -Phase 1
REM         start.cmd -Agent gemini -Phase 2
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
