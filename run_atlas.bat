@echo off
title ATLAS - Windows Desktop AI Assistant
color 0B
echo ==============================================================
echo     ATLAS DESKTOP AI ASSISTANT - COMMAND CORE
echo ==============================================================
echo Checking Python environment...

if exist "venv\Scripts\python.exe" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
    python atlas_core.py
) else (
    echo Running with system Python...
    python atlas_core.py
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Atlas terminated unexpectedly.
    echo Please make sure dependencies are installed via: pip install -r requirements.txt
    pause
)
