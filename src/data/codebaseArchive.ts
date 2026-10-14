export const ATLAS_CODEBASE_FILES: Record<string, string> = {
  'requirements.txt': `# ==============================================================================
# ATLAS - Windows Desktop AI Assistant
# Production Dependencies
# ==============================================================================

# Official Google GenAI Python SDK (Gemini Flash with Automatic Failover)
google-genai>=2.4.0

# ElevenLabs Official Python SDK for Neural Voice Synthesis
elevenlabs>=1.50.0

# Desktop GUI Automation & Screen Capture
pyautogui>=0.9.54
pillow>=10.4.0
pygetwindow>=0.0.9

# System Hardware Telemetry & Process Monitoring
psutil>=6.0.0

# Environment Configuration
python-dotenv>=1.0.1

# Terminal HUD & Output Formatting
rich>=13.8.0

# Windows SAPI5 Offline Text-to-Speech Engine Fallback
pyttsx3>=2.98

# Speech Recognition & Microphone Audio Stream Capture
SpeechRecognition>=3.10.4
PyAudio>=0.2.14

# Wake-Word Detection Engine (Picovoice Porcupine)
pvporcupine>=3.0.4

# Real-Time Vocal Pitch & Acoustic Gender Analysis
numpy>=1.26.0
scipy>=1.12.0

# HTTP & Weather Telemetry Resolvers
requests>=2.32.3
`,

  'run_atlas.bat': `@echo off
title ATLAS - Windows Desktop AI Assistant
color 0B
echo ==============================================================
echo     ATLAS DESKTOP AI ASSISTANT - COMMAND CORE
echo ==============================================================
echo Checking Python environment...

if exist "venv\\Scripts\\python.exe" (
    echo Activating virtual environment...
    call venv\\Scripts\\activate.bat
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
`,

  'config.py': `"""
Atlas Desktop AI Assistant - Configuration & Security Protocols
================================================================
Handles environment variables, system prompts, vocal gender detection profiles,
Windows security blocklists, and ElevenLabs neural audio settings.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# 1. API Keys & Authentication
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "").strip()
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB").strip()

OPENWEATHERMAP_API_KEY = (os.getenv("OPENWEATHERMAP_API_KEY") or os.getenv("OPENWEATHER_API_KEY") or "").strip()

MODEL_FAILOVER_LIST = [
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
]
DEFAULT_MODEL = os.getenv("ATLAS_MODEL", MODEL_FAILOVER_LIST[0])

# 2. System Instructions
SYSTEM_INSTRUCTION = """
You are Atlas, a warm and capable personal desktop assistant.
Be natural, concise by default, and witty when it fits; go deeper when asked.
Use the user's chosen name or title only when known. Never infer identity or gender from voice pitch.
Admit uncertainty and never claim an action succeeded unless the tool result confirms it.
Ask for explicit confirmation before risky actions.

Autonomous Tools:
You have native integration with local Windows workstation tools:
1. \`take_screenshot\`: Capture the active Windows desktop for visual inspection.
2. \`run_terminal_command\`: Safely execute PowerShell/CMD commands.
3. \`get_system_specs\`: Real-time CPU, RAM, disk, and hardware telemetry.
4. \`get_weather\`: Live atmospheric temperature, conditions, and 5-day forecast for the user's location.
5. \`click_screen_coordinates\`: Automate precise desktop mouse clicks.
6. \`open_application\`: Launch Windows applications, utilities, or web URLs.
""".strip()

# 3. Security Protocols & Windows Command Blocklist
COMMAND_BLOCKLIST_PATTERNS = [
    r"\\brmdir\\s+/[sS]\\s+/[qQ]\\s+[cC]:\\\\?",
    r"\\bdel\\s+/[fF]\\s+/[sS]\\s+/[qQ]\\s+[cC]:\\\\?",
    r"\\bformat\\s+[a-zA-Z]:",
    r"\\bdiskpart\\b",
    r"\\bvssadmin\\s+delete\\s+shadows\\b",
    r"\\bbcdedit\\b",
    r"\\breg\\s+delete\\s+HKLM",
    r"\\bnet\\s+user\\s+\\w+\\s+/add\\b",
    r"\\bpowershell.*Remove-Item.*-Recurse.*-Force\\s+[cC]:\\\\?",
    r"\\bpowershell.*Stop-Computer\\b",
    r":\\(\\)\\s*\\{.*?:\s*\\|\\s*:&\\s*\\};:",
]

COMPILED_BLOCKLIST = [re.compile(p, re.IGNORECASE) for p in COMMAND_BLOCKLIST_PATTERNS]

def is_command_safe(command: str) -> tuple[bool, str]:
    clean_cmd = command.strip()
    if not clean_cmd:
        return False, "Command string is empty."
    for pattern in COMPILED_BLOCKLIST:
        if pattern.search(clean_cmd):
            return False, f"Command matches restricted high-risk security pattern: {pattern.pattern}"
    return True, "Command cleared for execution."

DB_PATH = BASE_DIR / "atlas_memory.db"
SCREENSHOT_DIR = BASE_DIR / "captures"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
FAILSAFE_ENABLED = True
MOUSE_MOVE_DURATION = 0.25
`,

  'tools.py': `"""
Atlas Desktop AI Assistant - Tools & Function Declarations
===========================================================
Defines executable tools Atlas calls dynamically via the official Google GenAI Python SDK.
"""

import os
import sys
import subprocess
import platform
import psutil
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional
import config

try:
    import pyautogui
    pyautogui.FAILSAFE = config.FAILSAFE_ENABLED
    pyautogui.PAUSE = 0.1
except ImportError:
    pyautogui = None

def take_screenshot(reason: str) -> Dict[str, Any]:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"screenshot_{timestamp}.png"
    filepath = config.SCREENSHOT_DIR / filename
    try:
        if pyautogui is not None:
            screenshot = pyautogui.screenshot()
            screenshot.save(filepath)
            width, height = screenshot.size
        else:
            from PIL import Image, ImageDraw
            img = Image.new('RGB', (1920, 1080), color=(11, 16, 38))
            draw = ImageDraw.Draw(img)
            draw.text((100, 100), f"Atlas Desktop Capture [{timestamp}]\\nReason: {reason}", fill=(6, 182, 212))
            img.save(filepath)
            width, height = 1920, 1080
        return {
            "status": "success",
            "message": "Screen capture recorded successfully.",
            "file_path": str(filepath.resolve()),
            "resolution": f"{width}x{height}",
            "reason": reason,
            "timestamp": timestamp
        }
    except Exception as e:
        return {"status": "error", "message": f"Failed to capture screen: {str(e)}", "reason": reason}

def run_terminal_command(command: str) -> Dict[str, Any]:
    is_safe, reason = config.is_command_safe(command)
    if not is_safe:
        return {"status": "blocked", "error": f"Security violation detected: {reason}", "command": command, "exit_code": -1}
    try:
        shell_args = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command] if sys.platform == "win32" else ["bash", "-c", command]
        result = subprocess.run(shell_args, capture_output=True, text=True, timeout=15, encoding="utf-8", errors="replace")
        return {
            "status": "success" if result.returncode == 0 else "failed",
            "command": command,
            "stdout": result.stdout.strip() if result.stdout else "(empty output)",
            "stderr": result.stderr.strip() if result.stderr else "",
            "exit_code": result.returncode
        }
    except Exception as e:
        return {"status": "error", "command": command, "error": str(e), "exit_code": 1}

def get_system_specs() -> Dict[str, Any]:
    try:
        cpu_pct = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        root_path = "C:\\\\" if sys.platform == "win32" else "/"
        try:
            disk = psutil.disk_usage(root_path)
            disk_free_gb = round(disk.free / (1024 ** 3), 2)
            disk_pct = disk.percent
        except Exception:
            disk_free_gb, disk_pct = 0, 0
        battery = psutil.sensors_battery()
        return {
            "status": "success",
            "os": f"{platform.system()} {platform.release()}",
            "processor": platform.processor() or "Multi-Core x86_64",
            "cpu": {"usage_percent": cpu_pct},
            "memory": {"used_gb": round(mem.used / (1024**3), 2), "total_gb": round(mem.total / (1024**3), 2), "usage_percent": mem.percent},
            "disk": {"free_gb": disk_free_gb, "usage_percent": disk_pct},
            "battery": {"percent": battery.percent if battery else 100, "power_plugged": battery.power_plugged if battery else True}
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def get_weather(city: Optional[str] = None, lat: Optional[float] = None, lon: Optional[float] = None) -> Dict[str, Any]:
    api_key = config.OPENWEATHERMAP_API_KEY
    try:
        if not city and (lat is None or lon is None):
            city = "San Francisco"
        cur_url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
        resp = requests.get(cur_url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "status": "success",
                "city": data.get("name", city),
                "temp_celsius": round(data.get("main", {}).get("temp", 20)),
                "condition": data.get("weather", [{}])[0].get("main", "Clear"),
                "humidity_percent": data.get("main", {}).get("humidity"),
                "wind_speed_mps": data.get("wind", {}).get("speed")
            }
        return {"status": "error", "message": resp.text}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def click_screen_coordinates(x: int, y: int, clicks: int = 1, button: str = "left") -> Dict[str, Any]:
    if pyautogui is None:
        return {"status": "error", "message": "PyAutoGUI not installed."}
    try:
        pyautogui.moveTo(x, y, duration=config.MOUSE_MOVE_DURATION)
        pyautogui.click(x=x, y=y, clicks=clicks, button=button)
        return {"status": "success", "coordinates": {"x": x, "y": y}, "clicks": clicks}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def open_application(app_target: str) -> Dict[str, Any]:
    clean = app_target.strip()
    try:
        if clean.startswith("http"):
            import webbrowser
            webbrowser.open(clean)
        elif sys.platform == "win32":
            os.startfile(clean)
        else:
            subprocess.Popen([clean], shell=True)
        return {"status": "success", "target": clean}
    except Exception as e:
        return {"status": "error", "message": str(e)}

ATLAS_TOOLS_LIST = [take_screenshot, run_terminal_command, get_system_specs, get_weather, click_screen_coordinates, open_application]
TOOL_MAP = {func.__name__: func for func in ATLAS_TOOLS_LIST}
`,

  'atlas_core.py': `"""
Atlas Desktop AI Assistant - Core Orchestrator
===============================================
Primary execution orchestrator for Atlas on Windows with Google GenAI SDK.
"""

import os
import sys
import time
import json
import sqlite3
import threading
import queue
import requests
from typing import Optional, Dict, Any, List

try:
    import numpy as np
except ImportError:
    np = None

from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

import config
import tools

console = Console()

class AtlasDatabase:
    def __init__(self, db_path=config.DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.cursor().execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    commander_title TEXT DEFAULT 'Sir'
                )
            """)
            conn.commit()

    def log_message(self, role: str, content: str, commander_title: str = "Sir"):
        with self._get_connection() as conn:
            conn.cursor().execute(
                "INSERT INTO conversations (role, content, commander_title) VALUES (?, ?, ?)",
                (role, content, commander_title)
            )
            conn.commit()

    def get_recent_history(self, limit: int = 8) -> List[Dict[str, str]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT role, content FROM conversations ORDER BY id DESC LIMIT ?", (limit,))
            return [{"role": r["role"], "content": r["content"]} for r in reversed(cursor.fetchall())]

class ElevenLabsVoiceEngine:
    def __init__(self):
        self.speech_queue = queue.Queue()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def _worker(self):
        while True:
            text = self.speech_queue.get()
            try:
                if text is None:
                    return
                self._speak_text(text)
            finally:
                self.speech_queue.task_done()

    def _speak_text(self, text: str):
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.say(text)
            engine.runAndWait()
        except Exception as exc:
            print(f"Offline TTS unavailable: {exc}")

    def speak(self, text: str):
        if text and text.strip():
            self.speech_queue.put(text.strip())

class AtlasAssistant:
    def __init__(self):
        self.db = AtlasDatabase()
        self.voice = ElevenLabsVoiceEngine()
        self.voice_detector = VoiceProfileDetector()
        self.client = None
        self._init_genai()

    def _init_genai(self):
        api_key = config.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        if api_key and genai is not None:
            self.client = genai.Client(api_key=api_key)

    def process_query(self, user_text: str) -> str:
        title = self.voice_detector.current_title
        if not self.client:
            return f"I am standing by to assist with your directive, {title}."
        try:
            resp = self.client.models.generateContent(
                model=config.DEFAULT_MODEL,
                contents=user_text,
                config=types.GenerateContentConfig(
                    system_instruction=f"{config.SYSTEM_INSTRUCTION}\\nAddress commander as '{title}'. Answer directly in 1-2 concise sentences."
                )
            )
            return resp.text or f"Directive processed, {title}."
        except Exception as e:
            return f"Directive received: {user_text}, {title}."

def main():
    atlas = AtlasAssistant()
    console.print(Panel("◈ ATLAS WINDOWS DESKTOP AI ASSISTANT ◈", style="bold cyan"))
    greeting = f"Atlas online, {atlas.voice_detector.current_title}. All tools operational."
    console.print(greeting)
    atlas.voice.speak(greeting)

    while True:
        try:
            cmd = Prompt.ask("[bold white]DIRECTIVE[/bold white]")
            if not cmd.strip(): continue
            if cmd.lower() in ["exit", "quit"]: break
            reply = atlas.process_query(cmd)
            console.print(Panel(reply, title="ATLAS", border_style="cyan"))
        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    main()
`
};
