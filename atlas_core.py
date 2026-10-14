"""
Atlas Desktop AI Assistant - Core Orchestrator
===============================================
Primary execution orchestrator for Atlas running on Windows.
- Official Google GenAI SDK (google-genai) with dynamic model failover
- Real-time vocal pitch/gender recognition: dynamically addresses user as 'Sir' or 'Madam'
- Continuous background listening loop and hands-free wake-word detection
- Direct and accurate question-answering with tool execution (no canned boilerplate)
- ElevenLabs neural text-to-speech integration with SAPI5 fallback
- Thread-safe SQLite persistence for conversation logs and audit trails (atlas_memory.db)
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

# Acoustic analysis for vocal pitch & gender detection
try:
    import numpy as np
except ImportError:
    np = None

# Cyberpunk Terminal UI
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.prompt import Prompt
from rich import box

# Official Google GenAI Python SDK
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

import config
import tools

console = Console()

# -----------------------------------------------------------------------------
# 1. SQLite Database Persistence (Conversation, Tool Audits, Alerts)
# -----------------------------------------------------------------------------
class AtlasDatabase:
    """Thread-safe ACID persistence for conversation history, tool executions, and alerts."""

    def __init__(self, db_path=config.DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    commander_title TEXT DEFAULT 'Sir'
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tool_audit (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    tool_name TEXT NOT NULL,
                    arguments TEXT,
                    result_summary TEXT,
                    status TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    alert_type TEXT NOT NULL,
                    details TEXT NOT NULL
                )
            """)
            conn.commit()

    def log_message(self, role: str, content: str, commander_title: str = "Sir"):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO conversations (role, content, commander_title) VALUES (?, ?, ?)",
                (role, content, commander_title)
            )
            conn.commit()

    def log_tool(self, tool_name: str, arguments: dict, result: dict):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO tool_audit (tool_name, arguments, result_summary, status) VALUES (?, ?, ?, ?)",
                (
                    tool_name,
                    json.dumps(arguments, default=str),
                    json.dumps(result, default=str)[:600],
                    result.get("status", "unknown")
                )
            )
            conn.commit()

    def get_recent_history(self, limit: int = 8) -> List[Dict[str, str]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT role, content FROM conversations ORDER BY id DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


# -----------------------------------------------------------------------------
# 2. Vocal Pitch & Acoustic Gender Recognition Pipeline
# -----------------------------------------------------------------------------
class VoiceProfileDetector:
    """
    Extracts fundamental vocal frequency (F0) from raw PCM audio frames
    using autocorrelation to classify speaker gender into 'Sir' or 'Madam'.
    """

    def __init__(self):
        self.current_title = "Sir"
        self.last_pitch_hz = 0.0

    def estimate_pitch_from_pcm(self, pcm_bytes: bytes, sample_rate: int = 16000) -> float:
        """Calculates fundamental frequency via normalized autocorrelation."""
        if np is None or len(pcm_bytes) < 1024:
            return 0.0

        try:
            # Convert raw 16-bit PCM bytes to numpy float array
            audio_data = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)

            # Center-clipping or mean subtraction
            audio_data -= np.mean(audio_data)
            energy = np.sum(audio_data ** 2)
            if energy < 1e5:  # Audio silence or low background noise
                return 0.0

            # Autocorrelation
            corr = np.correlate(audio_data, audio_data, mode="full")
            corr = corr[len(corr) // 2:]

            # Frequency boundaries
            min_lag = int(sample_rate / config.VOICE_PROFILE_CONFIG.get("max_pitch_hz", 350.0))
            max_lag = int(sample_rate / config.VOICE_PROFILE_CONFIG.get("min_pitch_hz", 75.0))

            if max_lag >= len(corr):
                max_lag = len(corr) - 1

            if min_lag >= max_lag:
                return 0.0

            peak_lag = min_lag + np.argmax(corr[min_lag:max_lag])
            if corr[peak_lag] > 0.3 * corr[0]:
                pitch_hz = sample_rate / peak_lag
                return round(float(pitch_hz), 1)
        except Exception:
            pass

        return 0.0

    def process_audio_frame(self, pcm_bytes: bytes, sample_rate: int = 16000) -> str:
        """Detects vocal pitch and updates dynamic address honorific."""
        pitch = self.estimate_pitch_from_pcm(pcm_bytes, sample_rate)
        if pitch > 0.0:
            self.last_pitch_hz = pitch
            threshold = config.VOICE_PROFILE_CONFIG.get("pitch_gender_threshold_hz", 160.0)
            if pitch >= threshold:
                self.current_title = "Madam"
            else:
                self.current_title = "Sir"

        return self.current_title


# -----------------------------------------------------------------------------
# 3. ElevenLabs Neural Text-to-Speech Engine
# -----------------------------------------------------------------------------
class ElevenLabsVoiceEngine:
    """Non-blocking ElevenLabs neural voice synthesizer with SAPI5 offline fallback."""

    def __init__(self):
        self.speech_queue = queue.Queue()
        self.is_speaking = False
        self._worker_thread = threading.Thread(target=self._speech_worker, daemon=True)
        self._worker_thread.start()

    def _speech_worker(self):
        while True:
            text = self.speech_queue.get()
            if text is None:
                break

            self.is_speaking = True
            played = False

            # 1. Primary: ElevenLabs Neural Audio
            eleven_key = config.ELEVENLABS_API_KEY
            if eleven_key:
                try:
                    voice_id = config.ELEVENLABS_VOICE_ID or "pNInz6obpgDQGcFmaJgB"
                    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
                    clean_text = text.replace("*", "").replace("#", "").replace("`", "").strip()[:500]

                    resp = requests.post(
                        url,
                        headers={
                            "xi-api-key": eleven_key,
                            "Content-Type": "application/json",
                            "Accept": "audio/mpeg"
                        },
                        json={
                            "text": clean_text,
                            "model_id": "eleven_turbo_v2_5",
                            "voice_settings": {"stability": 0.55, "similarity_boost": 0.85}
                        },
                        timeout=8
                    )
                    if resp.status_code == 200:
                        temp_mp3 = config.BASE_DIR / "temp_atlas_voice.mp3"
                        with open(temp_mp3, "wb") as f:
                            f.write(resp.content)

                        if sys.platform == "win32":
                            os.system(f'powershell -c "(New-Object Media.SoundPlayer \'{temp_mp3}\').PlaySync();" 2>$null || start /min wmplayer "{temp_mp3}"')
                        played = True
                except Exception:
                    played = False

            # 2. Fallback: Native Windows SAPI5 Speech
            if not played:
                try:
                    import pyttsx3
                    engine = pyttsx3.init(driverName="sapi5" if sys.platform == "win32" else None)
                    engine.setProperty("rate", 185)
                    engine.setProperty("volume", 0.95)
                    engine.say(text)
                    engine.runAndWait()
                except Exception:
                    pass

            self.is_speaking = False
            self.speech_queue.task_done()

    def speak(self, text: str):
        if text and text.strip():
            self.speech_queue.put(text.strip())


# -----------------------------------------------------------------------------
# 4. Atlas Core Assistant
# -----------------------------------------------------------------------------
class AtlasAssistant:
    def __init__(self):
        self.db = AtlasDatabase()
        self.voice = ElevenLabsVoiceEngine()
        self.voice_detector = VoiceProfileDetector()
        self.client = None
        self._init_genai()

    def _init_genai(self):
        """Initializes the official Google GenAI SDK client."""
        if genai is None:
            console.print("[bold red][!] Error:[/bold red] 'google-genai' SDK is not installed.")
            return

        api_key = config.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            console.print(Panel(
                "[bold yellow]Notice:[/bold yellow] GEMINI_API_KEY not found in environment or .env file.\n"
                "Atlas will operate in diagnostic mode until key is supplied.",
                border_style="yellow"
            ))
            return

        try:
            self.client = genai.Client(api_key=api_key)
            console.print("[bold cyan][✓] Google GenAI Client Initialized.[/bold cyan]")
        except Exception as e:
            console.print(f"[bold red][!] GenAI Client Initialization Error:[/bold red] {e}")

    def execute_tool(self, tool_name: str, args: dict) -> dict:
        """Executes a declared function tool with audit logging."""
        if tool_name not in tools.TOOL_MAP:
            return {"status": "error", "message": f"Tool '{tool_name}' is not recognized."}

        func = tools.TOOL_MAP[tool_name]
        try:
            result = func(**args)
            self.db.log_tool(tool_name, args, result)
            return result
        except Exception as e:
            err_res = {"status": "error", "message": str(e)}
            self.db.log_tool(tool_name, args, err_res)
            return err_res

    def process_query(self, user_text: str, pcm_audio: Optional[bytes] = None) -> str:
        """
        Processes the commander's question or directive directly and accurately.
        Dynamically analyzes vocal pitch to determine whether to address the user as 'Sir' or 'Madam'.
        """
        # 1. Real-time vocal pitch/gender recognition
        if pcm_audio is not None:
            commander_title = self.voice_detector.process_audio_frame(pcm_audio)
        else:
            commander_title = self.voice_detector.current_title

        self.db.log_message("user", user_text, commander_title)

        if not self.client:
            return self._fallback_answer(user_text, commander_title)

        # 2. Google GenAI call with model failover list
        history = self.db.get_recent_history(limit=6)
        contents = [
            *[{"role": h["role"] if h["role"] != "assistant" else "model", "parts": [{"text": h["content"]}]} for h in history[:-1]],
            {"role": "user", "parts": [{"text": user_text}]}
        ]

        system_instruction_with_title = (
            f"{config.SYSTEM_INSTRUCTION}\n\n"
            f"Commander Profile: Real-time acoustic pitch indicates speaker is {commander_title}.\n"
            f"Address Directive: You MUST address the user as '{commander_title}'.\n"
            f"CRITICAL DIRECTIVE: Answer whatever question or topic the user asked directly and concisely. "
            f"Do NOT provide a lot of explanation, filler, or preamble. Limit response to 1-2 sharp, articulate sentences unless in-depth code was explicitly commanded."
        )

        for model_name in config.MODEL_FAILOVER_LIST:
            try:
                response = self.client.models.generateContent(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction_with_title,
                        tools=tools.ATLAS_TOOLS_LIST,
                        temperature=0.2
                    )
                )

                candidate = response.candidates[0] if response.candidates else None
                function_calls = [p.function_call for p in candidate.content.parts if p.function_call] if candidate else []
                text_parts = [p.text for p in candidate.content.parts if p.text] if candidate else []

                # Handle dynamic tool calling
                if function_calls:
                    for fc in function_calls:
                        tool_name = fc.name
                        tool_args = fc.args or {}
                        console.print(f"[dim cyan]⚡ [TOOL EXECUTION]: {tool_name}({tool_args})[/dim cyan]")
                        tool_res = self.execute_tool(tool_name, tool_args)
                        
                        # Return tool execution result back to Gemini
                        followup = self.client.models.generateContent(
                            model=model_name,
                            contents=[
                                *contents,
                                types.Part.from_function_response(name=tool_name, response={"result": tool_res})
                            ],
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction_with_title,
                                temperature=0.2
                            )
                        )
                        if followup.text:
                            text_parts = [followup.text]

                reply_text = "\n".join(text_parts).strip()
                if not reply_text:
                    reply_text = f"Directive acknowledged and completed, {commander_title}."

                # Ensure honorific match
                if commander_title == "Madam":
                    reply_text = reply_text.replace("sir", "madam").replace("Sir", "Madam")
                else:
                    reply_text = reply_text.replace("madam", "sir").replace("Madam", "Sir")

                self.db.log_message("assistant", reply_text, commander_title)
                self.voice.speak(reply_text)
                return reply_text

            except Exception as e:
                console.print(f"[dim yellow][Model failover: {model_name} -> {str(e)[:60]}][/dim yellow]")
                continue

        # If all API model calls failed, provide direct intelligent local fallback
        return self._fallback_answer(user_text, commander_title)

    def _fallback_answer(self, user_text: str, commander_title: str) -> str:
        """Direct answer for queries when API is unavailable."""
        lower = user_text.lower()
        if "weather" in lower or "temperature" in lower:
            w = tools.get_weather()
            ans = f"Current atmospheric telemetry for {w.get('city')}: {w.get('temp_celsius')}°C, {w.get('condition')}, humidity at {w.get('humidity_percent')}%, {commander_title}."
        elif "spec" in lower or "cpu" in lower or "telemetry" in lower:
            specs = tools.get_system_specs()
            ans = f"Telemetry nominal, {commander_title}: CPU load is at {specs['cpu']['usage_percent']}%, RAM utilized is {specs['memory']['usage_percent']}%, disk storage optimal."
        elif "screenshot" in lower or "screen" in lower:
            res = tools.take_screenshot("Manual operator request")
            ans = f"Desktop screen capture recorded to {res.get('file_path')}, {commander_title}."
        else:
            ans = f"I am standing by to assist with your directive: '{user_text}', {commander_title}. All tools are online."

        self.db.log_message("assistant", ans, commander_title)
        self.voice.speak(ans)
        return ans


# -----------------------------------------------------------------------------
# 5. Continuous Background Listening & Wake-Word Service
# -----------------------------------------------------------------------------
class ContinuousListeningService(threading.Thread):
    """
    Hands-free background microphone listener that captures the commander's voice,
    analyzes vocal pitch in real time, and dispatches the query directly to Atlas.
    """

    def __init__(self, assistant_ref: AtlasAssistant):
        super().__init__(daemon=True)
        self.assistant = assistant_ref
        self.running = True

    def run(self):
        try:
            import speech_recognition as sr
            recognizer = sr.Recognizer()
            recognizer.energy_threshold = 280
            recognizer.dynamic_energy_threshold = True

            with sr.Microphone() as source:
                recognizer.adjust_for_ambient_noise(source, duration=1.0)
                console.print(f"[bold cyan][✓] Atlas Voice Processing Pipeline Active[/bold cyan] (Continuous Hands-Free Standby)\n")

                while self.running:
                    try:
                        audio = recognizer.listen(source, timeout=None, phrase_time_limit=10)
                        raw_data = audio.get_raw_data()
                        
                        # Real-time vocal pitch/gender recognition
                        detected_title = self.assistant.voice_detector.process_audio_frame(raw_data, audio.sample_rate)

                        # Speech-to-Text
                        transcript = recognizer.recognize_google(audio).strip()
                        if transcript:
                            console.print(f"\n[bold white]COMMANDER ({detected_title}):[/bold white] {transcript}")
                            with console.status(f"[cyan]Atlas reasoning for {detected_title}...[/cyan]"):
                                reply = self.assistant.process_query(transcript, raw_data)
                            console.print(Panel(f"[bold cyan]{reply}[/bold cyan]", title=f"[cyan]ATLAS RESPONSE ({detected_title})[/cyan]", border_style="cyan"))

                    except sr.UnknownValueError:
                        pass
                    except Exception as e:
                        time.sleep(0.3)
        except Exception as e:
            console.print(f"[dim yellow][i] Background microphone pipeline operating in terminal keyboard mode ({e}).[/dim yellow]")


# -----------------------------------------------------------------------------
# 6. Terminal Interface Entrypoint
# -----------------------------------------------------------------------------
def main():
    atlas = AtlasAssistant()

    console.clear()
    console.print(Panel(
        Text(
            "◈ ATLAS DESKTOP AI ASSISTANT ◈\n"
            "Vocal Pitch & Gender Recognition Active · ElevenLabs Neural TTS · Google GenAI SDK",
            justify="center",
            style="bold cyan"
        ),
        box=box.HEAVY,
        border_style="cyan"
    ))

    # Start background continuous audio stream listener
    listener = ContinuousListeningService(atlas)
    listener.start()

    initial_title = atlas.voice_detector.current_title
    greeting = f"Atlas online, {initial_title}. Subsystems calibrated and standing by for your directives."
    console.print(f"[bold cyan]Atlas:[/bold cyan] {greeting}\n")
    atlas.voice.speak(greeting)

    while True:
        try:
            cmd = Prompt.ask("[bold white]DIRECTIVE[/bold white]")
            if not cmd.strip():
                continue
            if cmd.strip().lower() in ["exit", "quit", "shutdown"]:
                farewell = f"Shutting down Atlas subsystems. Have a pleasant day, {atlas.voice_detector.current_title}."
                console.print(f"[bold cyan]Atlas:[/bold cyan] {farewell}")
                atlas.voice.speak(farewell)
                time.sleep(1.5)
                break

            reply = atlas.process_query(cmd)
            console.print(Panel(f"[bold cyan]{reply}[/bold cyan]", title="[cyan]ATLAS[/cyan]", border_style="cyan"))

        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    main()
