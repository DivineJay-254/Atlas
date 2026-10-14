# ATLAS - Desktop AI Assistant (Windows)
> Advanced Windows AI Desktop Assistant powered by Google AI Studio and the official `google-genai` Python SDK.

---

## ⚡ Architecture Overview

Atlas is a modular, production-ready desktop AI assistant engineered for Windows workstations. It operates with a crisp, poised demeanor ("Right away, sir", "Systems nominal") and is equipped with dynamic tool calling, autonomous desktop automation, hardware telemetry, and SAPI5 offline voice synthesis.

### Project Layout
```
├── requirements.txt      # Production Python dependencies (google-genai, pyautogui, rich, etc.)
├── config.py             # System instructions, command blocklists, safety rails, voice settings
├── tools.py              # Declared functions for Gemini tool-calling (desktop, terminal, telemetry)
├── atlas_core.py         # Google GenAI client, SQLite persistence, SAPI5 audio, Cyberpunk HUD
├── run_atlas.bat         # 1-click Windows launcher batch script
└── .env                  # API keys (GEMINI_API_KEY, PVPORCUPINE_ACCESS_KEY)
```

---

## 🚀 Quick Start on Windows

### 1. Prerequisites
- **Python 3.10+** (Ensure "Add Python to PATH" is checked during installation)
- A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

### 2. Installation
Open PowerShell or Command Prompt in the project directory:

```bash
# 1. Create a virtual environment
python -m venv venv

# 2. Activate the virtual environment
# In PowerShell:
.\venv\Scripts\Activate.ps1
# In Command Prompt:
.\venv\Scripts\activate.bat

# 3. Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY="YOUR_ACTUAL_GEMINI_API_KEY"
PVPORCUPINE_ACCESS_KEY="OPTIONAL_PICOVOICE_KEY"
ATLAS_MODEL="gemini-3.8-flash"
```

### 4. Launch Atlas
Simply double-click `run_atlas.bat` or run:
```bash
python atlas_core.py
```

---

## 🛠️ Implemented Gemini Tools

Atlas exposes 6 native tool declarations directly to the Gemini 3.8 Flash model:

| Tool | Parameters | Description |
|---|---|---|
| `take_screenshot` | `reason: str` | Captures the active Windows desktop screen and saves it for multi-modal analysis. |
| `run_terminal_command` | `command: str` | Safely executes non-destructive PowerShell/CMD commands with security blocklist checks. |
| `get_system_specs` | *(none)* | Returns real-time CPU load, memory utilization, disk storage, and battery metrics. |
| `get_geolocation` | *(none)* | Dynamically resolves public IP, approximate city, coordinates, and network provider. |
| `click_screen_coordinates`| `x: int, y: int, clicks: int` | Automates precise mouse clicks at coordinates with PyAutoGUI failsafe boundaries. |
| `open_application` | `app_target: str` | Launches Windows utilities (`calc`, `notepad`, `cmd`, `code`, or web URLs). |

---

## 🛡️ Security Rails & Command Blocklist
Atlas features pre-execution pattern matching in `config.py` that intercepts and blocks dangerous commands before they reach the shell:
- Root deletion (`rmdir /s /q C:\`, `del /f /s /q C:\`)
- Drive formatting (`format C:`)
- Disk partitioning (`diskpart`)
- Volume shadow copy tampering (`vssadmin delete shadows`)
- Unauthorized user creation (`net user ... /add`)

---

## 🎙️ Voice & Wake-Word
- **Voice Output**: Threaded, non-blocking Windows SAPI5 synthesizer (`pyttsx3`) with configurable rate and volume.
- **Wake-Word**: Optional Picovoice Porcupine integration for "Hey Atlas" hotword activation.
