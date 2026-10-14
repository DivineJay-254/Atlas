import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Shield,
  Terminal,
  Camera,
  Layers,
  Cpu,
  Volume2,
  VolumeX,
  Sparkles,
  Command,
  Clock,
  Radio,
  Power
} from 'lucide-react';
import { ArcCore } from './components/ArcCore';
import { TelemetryPanel } from './components/TelemetryPanel';
import { WeatherWidget } from './components/WeatherWidget';
import { DirectivesFeed } from './components/DirectivesFeed';
import { TerminalDrawer } from './components/TerminalDrawer';
import { CodebaseModal } from './components/CodebaseModal';
import { Message, SystemSpecs, WeatherData } from './types';

export default function App() {
  const [commanderTitle, setCommanderTitle] = useState<string>('Operator');
  const [voicePitchHz, setVoicePitchHz] = useState<number>(0);
  const [status, setStatus] = useState<'IDLE' | 'LISTENING' | 'COMPUTING' | 'SPEAKING'>('IDLE');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const [inputDirective, setInputDirective] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content: 'Atlas online. Subsystems calibrated, Windows security blocklists armed, and telemetry nominal. Standing by for your directives.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      commanderTitle: 'Sir',
      modelUsed: 'gemini-3.8-flash'
    }
  ]);

  const [systemSpecs, setSystemSpecs] = useState<SystemSpecs | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoadingSpecs, setIsLoadingSpecs] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [deviceCoords, setDeviceCoords] = useState<{ lat?: number; lon?: number }>({});

  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [isCodebaseOpen, setIsCodebaseOpen] = useState(false);

  const [currentTime, setCurrentTime] = useState<string>('');

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Update real-time clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initial Telemetry & Weather load
  useEffect(() => {
    // Try to get geolocation from browser or IP
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setDeviceCoords(coords);
          fetchWeather(coords);
        },
        () => {
          fetchWeather();
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    } else {
      fetchWeather();
    }

    fetchTelemetry();
  }, []);

  const fetchTelemetry = async () => {
    setIsLoadingSpecs(true);
    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: 'get_system_specs', args: {} })
      });
      const data = await res.json();
      if (data?.result?.status === 'success') {
        setSystemSpecs(data.result);
      }
    } catch (err) {
      console.warn('Telemetry fetch error:', err);
    } finally {
      setIsLoadingSpecs(false);
    }
  };

  const fetchWeather = async (coords?: { lat?: number; lon?: number }) => {
    setIsLoadingWeather(true);
    try {
      const q = coords?.lat && coords?.lon ? `?lat=${coords.lat}&lon=${coords.lon}` : '';
      const res = await fetch(`/api/weather${q}`);
      const data = await res.json();
      if (data && !data.error) {
        setWeatherData(data);
      }
    } catch (err) {
      console.warn('Weather fetch error:', err);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Play Neural Voice Synthesis (ElevenLabs with Web Speech fallback)
  const playSpeech = async (msgId: string, text: string) => {
    if (isAudioMuted) return;

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setPlayingAudioId(msgId);
    setStatus('SPEAKING');

    try {
      const res = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (res.ok) {
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.onended = () => {
          setPlayingAudioId(null);
          setStatus('IDLE');
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          fallbackWebSpeech(text, msgId);
        };

        await audio.play();
        return;
      }
    } catch {
      // Fallback
    }

    fallbackWebSpeech(text, msgId);
  };

  const fallbackWebSpeech = (text: string, msgId: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#`_]/g, '').slice(0, 300);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onend = () => {
        setPlayingAudioId(null);
        setStatus('IDLE');
      };

      utterance.onerror = () => {
        setPlayingAudioId(null);
        setStatus('IDLE');
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setPlayingAudioId(null);
      setStatus('IDLE');
    }
  };

  // Handle Dispatching a Directive (via keyboard or speech)
  const handleSendDirective = async (directiveText?: string) => {
    const text = (directiveText || inputDirective).trim();
    if (!text) return;

    setInputDirective('');
    setStatus('COMPUTING');

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      commanderTitle
    };

    setMessages(prev => [...prev, userMsg]);

    try {
      const history = messages.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          deviceCoords,
          commanderTitle
        })
      });

      const data = await res.json();
      const replyText = data?.reply || `Directive processed, ${commanderTitle}.`;

      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commanderTitle,
        toolCalls: data?.toolCalls || [],
        modelUsed: data?.modelUsed || 'gemini-3.8-flash'
      };

      setMessages(prev => [...prev, assistantMsg]);

      // If audio isn't muted, automatically speak response
      if (!isAudioMuted) {
        playSpeech(assistantMsg.id, replyText);
      } else {
        setStatus('IDLE');
      }

      // If tools included get_system_specs or get_weather, sync widgets
      if (data?.toolCalls) {
        for (const tc of data.toolCalls) {
          if (tc.name === 'get_system_specs' && tc.result?.cpu) {
            setSystemSpecs(tc.result);
          } else if (tc.name === 'get_weather' && tc.result?.temp) {
            setWeatherData(tc.result);
          }
        }
      }
    } catch (err: any) {
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Subsystem alert: Exception occurred during directive execution. Standby mode restored, ${commanderTitle}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        commanderTitle
      };
      setMessages(prev => [...prev, errMsg]);
      setStatus('IDLE');
    }
  };

  const handleRunTerminalDirectly = async (command: string) => {
    const res = await fetch('/api/tools/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'run_terminal_command',
        args: { command }
      })
    });
    const data = await res.json();
    return data?.result;
  };

  return (
    <div className="min-h-screen bg-[#050714] text-slate-100 flex flex-col cyber-grid relative overflow-x-hidden">
      {/* Background scanline effect */}
      <div className="fixed inset-0 pointer-events-none scanline opacity-60 z-30" />

      {/* Top Holographic Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 border-b border-cyan-500/20 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center glow-cyan-sm">
              <Shield className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-cyber text-xl font-bold tracking-wider text-slate-100 text-glow-cyan">
                  ATLAS COMMAND CENTER
                </h1>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded">
                  v2.4 WORKSTATION
                </span>
              </div>
              <p className="font-mono text-[10px] text-slate-400">
                Official Google GenAI SDK · Neural Voice Synthesis · Autonomous Windows Tools
              </p>
            </div>
          </div>

          {/* Quick Subsystems Status Badges */}
          <div className="hidden lg:flex items-center space-x-4 font-mono text-xs">
            <div className="flex items-center space-x-1.5 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-slate-400">SYS:</span>
              <span className="text-emerald-400 font-semibold">ONLINE</span>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">MODEL:</span>
              <span className="text-cyan-300 font-semibold">Gemini 3.8 Flash</span>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-200">{currentTime || '00:00:00'}</span>
            </div>
          </div>

          {/* Top Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAudioMuted(!isAudioMuted)}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                isAudioMuted
                  ? 'bg-red-950/40 border-red-500/30 text-red-400'
                  : 'bg-slate-900 border-cyan-500/30 text-cyan-300 hover:border-cyan-400'
              }`}
              title={isAudioMuted ? 'Neural Audio Muted' : 'Neural Audio Active'}
            >
              {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsTerminalOpen(true)}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 rounded-lg font-mono text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Shell</span>
            </button>

            <button
              onClick={() => setIsCodebaseOpen(true)}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer glow-cyan-sm"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Python Codebase</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Command Grid */}
      <main className="max-w-7xl mx-auto w-full p-4 md:p-6 flex-1 flex flex-col gap-6">
        {/* Top Operational Telemetry Strip: Core Orb, Workstation Telemetry, Atmospheric Forecast */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <ArcCore
            status={status}
            commanderTitle={commanderTitle}
            onCommanderTitleChange={setCommanderTitle}
            onVoiceDirective={(transcript) => handleSendDirective(transcript)}
            voicePitchHz={voicePitchHz}
            setVoicePitchHz={setVoicePitchHz}
          />

          <TelemetryPanel
            specs={systemSpecs}
            isLoading={isLoadingSpecs}
            onRefresh={fetchTelemetry}
          />

          <WeatherWidget
            weather={weatherData}
            isLoading={isLoadingWeather}
            onRefresh={() => fetchWeather(deviceCoords)}
          />
        </div>

        {/* Tactical Directive Console & Message Feed */}
        <div className="flex-1 bg-slate-900/40 border border-cyan-500/20 rounded-2xl p-4 md:p-6 backdrop-blur-md flex flex-col justify-between min-h-[460px]">
          {/* Console Header & Quick Triggers */}
          <div className="border-b border-cyan-500/10 pb-3 mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Command className="w-4 h-4 text-cyan-400" />
              <h2 className="font-mono text-xs uppercase tracking-wider text-cyan-300 font-semibold">
                Directives & Subsystem Execution Log
              </h2>
            </div>

            {/* Quick Action Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => handleSendDirective('Run system diagnostic on workstation')}
                className="px-2.5 py-1 bg-slate-950/70 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-200 border border-slate-800 hover:border-cyan-500/40 rounded-lg text-xs font-mono transition-colors cursor-pointer"
              >
                Diagnostic Scan
              </button>
              <button
                onClick={() => handleSendDirective('Capture desktop screen')}
                className="px-2.5 py-1 bg-slate-950/70 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-200 border border-slate-800 hover:border-cyan-500/40 rounded-lg text-xs font-mono transition-colors cursor-pointer"
              >
                Screen Capture
              </button>
              <button
                onClick={() => handleSendDirective('Give me the current weather report and 5-day forecast')}
                className="px-2.5 py-1 bg-slate-950/70 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-200 border border-slate-800 hover:border-cyan-500/40 rounded-lg text-xs font-mono transition-colors cursor-pointer"
              >
                Weather Telemetry
              </button>
              <button
                onClick={() => handleSendDirective('Execute terminal command: ipconfig')}
                className="px-2.5 py-1 bg-slate-950/70 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-200 border border-slate-800 hover:border-cyan-500/40 rounded-lg text-xs font-mono transition-colors cursor-pointer"
              >
                Scan Network
              </button>
              <button
                onClick={() => handleSendDirective('Launch Windows Calculator')}
                className="px-2.5 py-1 bg-slate-950/70 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-200 border border-slate-800 hover:border-cyan-500/40 rounded-lg text-xs font-mono transition-colors cursor-pointer"
              >
                Launch Utility
              </button>
            </div>
          </div>

          {/* Interactive Directives Feed */}
          <DirectivesFeed
            messages={messages}
            onPlaySpeech={playSpeech}
            playingAudioId={playingAudioId}
          />

          {/* Directive Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendDirective();
            }}
            className="mt-4 pt-3 border-t border-cyan-500/10 flex items-center space-x-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inputDirective}
                onChange={(e) => setInputDirective(e.target.value)}
                placeholder={`Issue directive to Atlas (e.g. "Run diagnostics", "Take screenshot", "Check network IP")...`}
                className="w-full bg-slate-950/80 border border-cyan-500/30 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 font-sans transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 hidden sm:inline">
                ENTER TO TRANSMIT
              </span>
            </div>

            <button
              type="submit"
              disabled={!inputDirective.trim() || status === 'COMPUTING'}
              className="p-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-semibold rounded-xl flex items-center justify-center transition-all cursor-pointer glow-cyan-sm"
              title="Transmit directive"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </main>

      {/* Terminal Drawer & Codebase Modals */}
      <TerminalDrawer
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        onRunCommand={handleRunTerminalDirectly}
      />

      <CodebaseModal
        isOpen={isCodebaseOpen}
        onClose={() => setIsCodebaseOpen(false)}
      />
    </div>
  );
}
