#!/usr/bin/env python3
"""
Math Tutor - Development Launcher
Starts both frontend and backend servers.
"""

import subprocess
import sys
import time
import webbrowser
import threading
import requests
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT

def check_backend():
    """Check if backend is already running."""
    try:
        resp = requests.get("http://127.0.0.1:8000/docs", timeout=2)
        return resp.status_code == 200
    except:
        return False

def start_backend():
    """Start the FastAPI backend."""
    print("Starting backend...")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"],
        cwd=BACKEND_DIR,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0
    )
    return proc

def start_frontend():
    """Start the Vite frontend."""
    print("Starting frontend...")
    proc = subprocess.Popen(
        ["npm.cmd", "run", "dev"],
        cwd=FRONTEND_DIR,
        creationflags=subprocess.CREATE_NEW_CONSOLE if sys.platform == "win32" else 0
    )
    return proc

def wait_for_backend(timeout=30):
    """Wait for backend to be ready."""
    print("Waiting for backend...")
    start = time.time()
    while time.time() - start < timeout:
        if check_backend():
            print("Backend ready!")
            return True
        time.sleep(1)
    print("Backend did not start in time")
    return False

def main():
    print("=" * 50)
    print("Math Tutor - Development Launcher")
    print("=" * 50)
    
    # Check backend
    if check_backend():
        print("Backend already running on http://127.0.0.1:8000")
    else:
        backend_proc = start_backend()
        if not wait_for_backend():
            print("Failed to start backend")
            return 1
    
    # Start frontend
    frontend_proc = start_frontend()
    
    print()
    print("Services started:")
    print("  Frontend: http://localhost:5173")
    print("  Backend:  http://127.0.0.1:8000")
    print("  API Docs: http://127.0.0.1:8000/docs")
    print()
    print("Press Ctrl+C to stop...")
    
    try:
        # Keep running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        frontend_proc.terminate()
        if 'backend_proc' in locals():
            backend_proc.terminate()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())