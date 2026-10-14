"""
Atlas Desktop AI Assistant - Configuration & Security Protocols
================================================================
Handles environment variables, system prompts, vocal gender detection profiles,
Windows security blocklists, and ElevenLabs neural audio settings.
"""

import os
import re
import sys
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# -----------------------------------------------------------------------------
# 1. API Keys & Authentication
# -----------------------------------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
if not GEMINI_API_KEY:
    print("[WARNING] GEMINI_API_KEY is not set. Please set it in .env or your environment variables.")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "sk_d2c12a9999c1320d94c845084ed1f95439cdceb6df10742b").strip()
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB").strip()  # "Adam" deep analytical voice

# OpenWeatherMap API Key
OPENWEATHERMAP_API_KEY = (
    os.getenv("OPENWEATHERMAP_API_KEY") or 
    os.getenv("OPENWEATHER_API_KEY") or 
    "e8e7788c9aa6a62a91298a363cf16ec5"
).strip()

PVPORCUPINE_ACCESS_KEY = os.getenv("PVPORCUPINE_ACCESS_KEY", "").strip()

# Target Models with Automatic Failover
MODEL_FAILOVER_LIST = [
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.1-flash-lite"
]

DEFAULT_MODEL = os.getenv("ATLAS_MODEL", MODEL_FAILOVER_LIST[0])

# -----------------------------------------------------------------------------
# 2. System Instructions & Honorific Rules
# -----------------------------------------------------------------------------
SYSTEM_INSTRUCTION = """
You are "Atlas", an elite, autonomous desktop AI assistant running natively on the user's Windows workstation.

Persona & Demeanor:
- Crisp, highly analytical, sharp, courteous, and impeccably poised.
- Quiet competence: deliver information with executive clarity, precision, and tactical elegance.
- Crucial Honorific Rule:
  * Dynamically address the commander as "Sir" (for male voice profiles) or "Madam" (for female voice profiles).
  * NEVER use preset generic names like "Alex". You serve your Commander.
- Conversational Directness:
  * Answer questions directly, concisely, and accurately without lots of explanation, filler, or unsolicited backstory.
  * Deliver the exact answer in 1-2 sharp, articulate sentences unless detailed code or step-by-step procedures were explicitly requested.
  * Never give canned, evasive, or repetitive boilerplate responses.

Autonomous Tools:
You have native integration with local Windows workstation tools:
1. `take_screenshot`: Capture the active Windows desktop for visual inspection.
2. `run_terminal_command`: Safely execute PowerShell/CMD commands.
3. `get_system_specs`: Real-time CPU, RAM, disk, and hardware telemetry.
4. `get_weather`: Live atmospheric temperature, conditions, and 5-day forecast for the user's location.
5. `click_screen_coordinates`: Automate precise desktop mouse clicks.
6. `open_application`: Launch Windows applications, utilities, or web URLs.

Invoke tools proactively whenever they assist in fulfilling the commander's directive.
""".strip()

# -----------------------------------------------------------------------------
# 3. Acoustic Voice Pitch & Gender Recognition Settings
# -----------------------------------------------------------------------------
VOICE_PROFILE_CONFIG = {
    # Fundamental vocal frequency threshold (Hz):
    # Adult male average fundamental frequency: ~85Hz - ~155Hz  -> "Sir"
    # Adult female average fundamental frequency: ~165Hz - ~255Hz -> "Madam"
    "pitch_gender_threshold_hz": 160.0,
    "default_honorific": "Sir",
    "min_pitch_hz": 75.0,
    "max_pitch_hz": 350.0,
}

# -----------------------------------------------------------------------------
# 4. Security Protocols & Windows Command Blocklist
# -----------------------------------------------------------------------------
COMMAND_BLOCKLIST_PATTERNS = [
    r"\brmdir\s+/[sS]\s+/[qQ]\s+[cC]:\\?",       # Silent recursive deletion of C:\
    r"\bdel\s+/[fF]\s+/[sS]\s+/[qQ]\s+[cC]:\\?",  # Force recursive deletion of C:\
    r"\bformat\s+[a-zA-Z]:",                     # Drive formatting
    r"\bdiskpart\b",                             # Low-level disk partitioning
    r"\bvssadmin\s+delete\s+shadows\b",          # Shadow copy tampering
    r"\bbcdedit\b",                              # Boot configuration tampering
    r"\breg\s+delete\s+HKLM",                     # Root registry key deletion
    r"\bnet\s+user\s+\w+\s+/add\b",             # Unauthorized local account creation
    r"\bpowershell.*Remove-Item.*-Recurse.*-Force\s+[cC]:\\?", # PowerShell root wipe
    r"\bpowershell.*Stop-Computer\b",            # Sudden system shutdown
    r":\(\)\s*\{.*?:\s*\|\s*:&\s*\};:",          # Fork bombs
]

COMPILED_BLOCKLIST = [re.compile(p, re.IGNORECASE) for p in COMMAND_BLOCKLIST_PATTERNS]

def is_command_safe(command: str) -> tuple[bool, str]:
    """Validates whether a shell command violates Windows security safety protocols."""
    clean_cmd = command.strip()
    if not clean_cmd:
        return False, "Command string is empty."
    for pattern in COMPILED_BLOCKLIST:
        if pattern.search(clean_cmd):
            return False, f"Command matches restricted high-risk security pattern: {pattern.pattern}"
    return True, "Command cleared for execution."

# -----------------------------------------------------------------------------
# 5. Audio, Wake-Word, and Database Paths
# -----------------------------------------------------------------------------
DB_PATH = BASE_DIR / "atlas_memory.db"
SCREENSHOT_DIR = BASE_DIR / "captures"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

WAKE_WORD = "hey atlas"
FAILSAFE_ENABLED = True
MOUSE_MOVE_DURATION = 0.25
