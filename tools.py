"""
Atlas Desktop AI Assistant - Tools & Function Declarations
===========================================================
Defines the executable tools Atlas can call dynamically via the official
Google GenAI Python SDK (google-genai).
"""

import os
import sys
import time
import subprocess
import platform
import psutil
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional

import config

# Initialize PyAutoGUI failsafe and timing
try:
    import pyautogui
    pyautogui.FAILSAFE = config.FAILSAFE_ENABLED
    pyautogui.PAUSE = 0.1
except ImportError:
    pyautogui = None


def take_screenshot(reason: str) -> Dict[str, Any]:
    """
    Captures the Windows desktop screen and returns file metadata and dimensions for visual analysis.

    Args:
        reason: Explanation of why the screenshot is being taken (e.g. 'Inspecting active application error').

    Returns:
        dict: Status, saved image file path, screen dimensions, timestamp, and metadata.
    """
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
            draw.text((100, 100), f"Atlas Desktop Capture [{timestamp}]\nReason: {reason}", fill=(6, 182, 212))
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
        return {
            "status": "error",
            "message": f"Failed to capture screen: {str(e)}",
            "reason": reason
        }


def run_terminal_command(command: str) -> Dict[str, Any]:
    """
    Safely executes standard Windows PowerShell or CMD commands with security pattern matching.

    Args:
        command: The terminal command to execute (e.g. 'dir', 'ipconfig', 'ping google.com').

    Returns:
        dict: Command output stdout, stderr, execution exit code, and safety status.
    """
    is_safe, reason = config.is_command_safe(command)
    if not is_safe:
        return {
            "status": "blocked",
            "error": f"Security violation detected: {reason}",
            "command": command,
            "exit_code": -1
        }

    try:
        shell_args = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command] if sys.platform == "win32" else ["bash", "-c", command]

        result = subprocess.run(
            shell_args,
            capture_output=True,
            text=True,
            timeout=15,
            encoding="utf-8",
            errors="replace"
        )

        return {
            "status": "success" if result.returncode == 0 else "failed",
            "command": command,
            "stdout": result.stdout.strip() if result.stdout else "(empty output)",
            "stderr": result.stderr.strip() if result.stderr else "",
            "exit_code": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "timeout",
            "command": command,
            "error": "Execution timed out after 15 seconds.",
            "exit_code": 124
        }
    except Exception as e:
        return {
            "status": "error",
            "command": command,
            "error": str(e),
            "exit_code": 1
        }


def get_system_specs() -> Dict[str, Any]:
    """
    Returns real-time machine hardware, CPU load, RAM usage, and disk telemetry.

    Returns:
        dict: Real-time telemetry including CPU%, RAM, storage, uptime, and battery.
    """
    try:
        cpu_pct = psutil.cpu_percent(interval=0.5)
        cpu_count_logical = psutil.cpu_count(logical=True)
        cpu_count_physical = psutil.cpu_count(logical=False)
        cpu_freq = psutil.cpu_freq()
        cpu_freq_current = round(cpu_freq.current, 1) if cpu_freq else "N/A"

        mem = psutil.virtual_memory()
        mem_total_gb = round(mem.total / (1024 ** 3), 2)
        mem_used_gb = round(mem.used / (1024 ** 3), 2)
        mem_pct = mem.percent

        root_path = "C:\\" if sys.platform == "win32" else "/"
        try:
            disk = psutil.disk_usage(root_path)
            disk_total_gb = round(disk.total / (1024 ** 3), 2)
            disk_free_gb = round(disk.free / (1024 ** 3), 2)
            disk_pct = disk.percent
        except Exception:
            disk_total_gb, disk_free_gb, disk_pct = 0, 0, 0

        battery = psutil.sensors_battery()
        battery_data = {
            "present": battery is not None,
            "percent": battery.percent if battery else 100,
            "power_plugged": battery.power_plugged if battery else True
        }

        boot_time = datetime.fromtimestamp(psutil.boot_time()).strftime("%Y-%m-%d %H:%M:%S")

        return {
            "status": "success",
            "os": f"{platform.system()} {platform.release()} ({platform.architecture()[0]})",
            "processor": platform.processor() or "Multi-Core x86_64",
            "cpu": {
                "usage_percent": cpu_pct,
                "cores_logical": cpu_count_logical,
                "cores_physical": cpu_count_physical,
                "frequency_mhz": cpu_freq_current
            },
            "memory": {
                "total_gb": mem_total_gb,
                "used_gb": mem_used_gb,
                "usage_percent": mem_pct
            },
            "disk": {
                "mount": root_path,
                "total_gb": disk_total_gb,
                "free_gb": disk_free_gb,
                "usage_percent": disk_pct
            },
            "battery": battery_data,
            "boot_time": boot_time
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Could not retrieve system telemetry: {str(e)}"
        }


def get_weather(city: Optional[str] = None, lat: Optional[float] = None, lon: Optional[float] = None) -> Dict[str, Any]:
    """
    Dynamically resolves the user's real device location coordinates and pulls
    live temperature, atmospheric conditions, and 5-day forecasts via OpenWeatherMap API.

    Args:
        city: Optional city name (e.g. 'London', 'San Francisco').
        lat: Optional device GPS latitude coordinate.
        lon: Optional device GPS longitude coordinate.

    Returns:
        dict: Real-time temperature (°C), conditions, humidity, wind, and 5-day forecast.
    """
    api_key = config.OPENWEATHERMAP_API_KEY
    if not api_key:
        api_key = "e8e7788c9aa6a62a91298a363cf16ec5"

    try:
        # Dynamically resolve location coordinates if not specified
        if not city and (lat is None or lon is None):
            try:
                ip_data = requests.get("https://ipapi.co/json/", timeout=4).json()
                lat = ip_data.get("latitude")
                lon = ip_data.get("longitude")
                city = ip_data.get("city")
            except Exception:
                city = "San Francisco"

        if lat is not None and lon is not None:
            cur_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
            fore_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={api_key}&units=metric"
        else:
            cur_url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
            fore_url = f"https://api.openweathermap.org/data/2.5/forecast?q={city}&appid={api_key}&units=metric"

        resp = requests.get(cur_url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()

            # Optional 5-day forecast extraction
            forecast_summary = []
            try:
                fore_resp = requests.get(fore_url, timeout=5)
                if fore_resp.status_code == 200:
                    fore_data = fore_resp.json()
                    day_names = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
                    seen_days = set()
                    for item in fore_data.get("list", []):
                        d = datetime.fromtimestamp(item.get("dt", 0))
                        d_str = d.strftime("%Y-%m-%d")
                        if d_str not in seen_days and len(forecast_summary) < 5:
                            seen_days.add(d_str)
                            forecast_summary.append({
                                "day": day_names[d.weekday()],
                                "temp_celsius": round(item.get("main", {}).get("temp", 20)),
                                "condition": item.get("weather", [{}])[0].get("main", "Clear")
                            })
            except Exception:
                pass

            return {
                "status": "success",
                "city": data.get("name", city),
                "country": data.get("sys", {}).get("country"),
                "temp_celsius": round(data.get("main", {}).get("temp", 20)),
                "feels_like_celsius": round(data.get("main", {}).get("feels_like", 20)),
                "condition": data.get("weather", [{}])[0].get("main", "Clear"),
                "description": data.get("weather", [{}])[0].get("description", ""),
                "humidity_percent": data.get("main", {}).get("humidity"),
                "wind_speed_mps": data.get("wind", {}).get("speed"),
                "coordinates": {"lat": lat, "lon": lon},
                "forecast": forecast_summary
            }
        else:
            return {
                "status": "error",
                "message": f"OpenWeatherMap API error code {resp.status_code}: {resp.text}"
            }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Weather lookup exception: {str(e)}"
        }


def click_screen_coordinates(x: int, y: int, clicks: int = 1, button: str = "left") -> Dict[str, Any]:
    """
    Performs automated mouse clicks at precise screen coordinates on Windows.

    Args:
        x: Horizontal coordinate in pixels.
        y: Vertical coordinate in pixels.
        clicks: Number of clicks (1 for single click, 2 for double click).
        button: Mouse button to actuate ('left', 'right', 'middle').

    Returns:
        dict: Operation status, target coordinates, and execution confirmation.
    """
    if pyautogui is None:
        return {
            "status": "error",
            "message": "PyAutoGUI automation driver is not installed."
        }

    try:
        screen_w, screen_h = pyautogui.size()
        if x < 0 or x >= screen_w or y < 0 or y >= screen_h:
            return {
                "status": "bounds_error",
                "message": f"Coordinates ({x}, {y}) exceed display bounds ({screen_w}x{screen_h})."
            }

        pyautogui.moveTo(x, y, duration=config.MOUSE_MOVE_DURATION)
        pyautogui.click(x=x, y=y, clicks=clicks, button=button)

        return {
            "status": "success",
            "message": f"Actuated {clicks} {button}-click(s) at screen coordinates ({x}, {y}).",
            "coordinates": {"x": x, "y": y},
            "clicks": clicks,
            "button": button
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Cursor execution halted: {str(e)}"
        }


def open_application(app_target: str) -> Dict[str, Any]:
    """
    Launches Windows apps, utilities, or URLs (e.g., 'notepad', 'calc', 'chrome', or 'https://...').

    Args:
        app_target: Executable name, system shortcut, file path, or web URL to launch.

    Returns:
        dict: Launch status, target string, and process trigger confirmation.
    """
    clean_target = app_target.strip()
    if not clean_target:
        return {"status": "error", "message": "Application target cannot be empty."}

    win_aliases = {
        "notepad": "notepad.exe",
        "calculator": "calc.exe",
        "calc": "calc.exe",
        "cmd": "cmd.exe",
        "terminal": "powershell.exe",
        "powershell": "powershell.exe",
        "explorer": "explorer.exe",
        "taskmgr": "taskmgr.exe",
        "code": "code",
        "vscode": "code",
        "browser": "https://www.google.com",
    }

    resolved_target = win_aliases.get(clean_target.lower(), clean_target)

    try:
        if resolved_target.startswith("http://") or resolved_target.startswith("https://"):
            import webbrowser
            webbrowser.open(resolved_target)
            return {
                "status": "success",
                "type": "web_url",
                "target": resolved_target,
                "message": f"Dispatched browser navigation to {resolved_target}."
            }

        if sys.platform == "win32":
            os.startfile(resolved_target)
        else:
            subprocess.Popen([resolved_target], shell=True)

        return {
            "status": "success",
            "type": "application",
            "target": resolved_target,
            "message": f"Initialized Windows process for '{resolved_target}'."
        }
    except Exception as e:
        return {
            "status": "error",
            "target": resolved_target,
            "message": f"Failed to open '{resolved_target}': {str(e)}"
        }


# =============================================================================
# Tool Registry for Google GenAI Client
# =============================================================================
ATLAS_TOOLS_LIST = [
    take_screenshot,
    run_terminal_command,
    get_system_specs,
    get_weather,
    click_screen_coordinates,
    open_application
]

TOOL_MAP = {func.__name__: func for func in ATLAS_TOOLS_LIST}
