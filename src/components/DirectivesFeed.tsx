import React from 'react';
import { Terminal, ShieldCheck, Camera, Volume2, Cpu, MapPin, Sparkles, AlertTriangle } from 'lucide-react';
import { Message } from '../types';

interface DirectivesFeedProps {
  messages: Message[];
  onPlaySpeech: (msgId: string, text: string) => void;
  playingAudioId: string | null;
}

export const DirectivesFeed: React.FC<DirectivesFeedProps> = ({
  messages,
  onPlaySpeech,
  playingAudioId
}) => {
  return (
    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
        >
          {/* Sender Header */}
          <div className="flex items-center space-x-2 mb-1 px-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              {msg.role === 'user' ? `COMMANDER (${msg.commanderTitle || 'Sir'})` : 'ATLAS CORE'}
            </span>
            <span className="font-mono text-[9px] text-slate-400">
              {msg.timestamp}
            </span>
          </div>

          {/* Message Bubble */}
          <div
            className={`max-w-[85%] rounded-2xl p-4 transition-all duration-200 ${
              msg.role === 'user'
                ? 'bg-cyan-950/40 border border-cyan-500/40 text-cyan-100'
                : 'bg-slate-900/60 border border-slate-700/60 text-slate-200 backdrop-blur-md shadow-lg'
            }`}
          >
            <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap">
              {msg.content}
            </p>

            {/* Tool Executions Badges & Results */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2.5">
                {msg.toolCalls.map((tc, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950/70 border border-cyan-500/30 rounded-xl p-3 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        {tc.name === 'run_terminal_command' && <Terminal className="w-3.5 h-3.5 text-cyan-400" />}
                        {tc.name === 'take_screenshot' && <Camera className="w-3.5 h-3.5 text-amber-400" />}
                        {tc.name === 'get_system_specs' && <Cpu className="w-3.5 h-3.5 text-blue-400" />}
                        {tc.name === 'get_weather' && <Sparkles className="w-3.5 h-3.5 text-cyan-300" />}
                        {tc.name === 'get_geolocation' && <MapPin className="w-3.5 h-3.5 text-emerald-400" />}
                        <span className="text-cyan-300 font-semibold tracking-wider uppercase text-[11px]">
                          {tc.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center space-x-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>VERIFIED</span>
                      </span>
                    </div>

                    {/* Specific Tool Content Render */}
                    {tc.name === 'run_terminal_command' && (
                      <div className="bg-black/80 rounded p-2 text-slate-300 font-mono text-[11px] overflow-x-auto">
                        <div className="text-cyan-400 mb-1">$ {tc.args?.command}</div>
                        <pre className="text-slate-300 whitespace-pre-wrap">{tc.result?.stdout || tc.result?.error || 'Execution confirmed.'}</pre>
                      </div>
                    )}

                    {tc.name === 'take_screenshot' && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>File: {tc.result?.file_path}</span>
                          <span className="text-cyan-400 font-semibold">{tc.result?.resolution}</span>
                        </div>
                        {/* Simulated Mock capture frame */}
                        <div className="relative aspect-video bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 rounded border border-cyan-500/40 flex flex-col items-center justify-center p-3 text-center overflow-hidden">
                          <Camera className="w-8 h-8 text-cyan-400/60 mb-2" />
                          <span className="text-xs text-cyan-200 font-mono font-semibold">
                            Desktop Capture Buffer Nominal
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono mt-1">
                            Reason: {tc.args?.reason || 'Visual Inspection'}
                          </span>
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-emerald-400 border border-emerald-500/30">
                            LIVE FRAME
                          </div>
                        </div>
                      </div>
                    )}

                    {tc.name === 'get_system_specs' && (
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="text-slate-400">CPU Load: <span className="text-cyan-300 font-bold">{tc.result?.cpu?.usage_percent}%</span></div>
                        <div className="text-slate-400">RAM: <span className="text-blue-300 font-bold">{tc.result?.memory?.usage_percent}%</span></div>
                        <div className="text-slate-400">Drive (C:): <span className="text-emerald-300 font-bold">{tc.result?.disk?.free_gb} GB Free</span></div>
                        <div className="text-slate-400">OS: <span className="text-slate-200">{tc.result?.os}</span></div>
                      </div>
                    )}

                    {tc.name === 'get_weather' && (
                      <div className="flex items-center justify-between text-[11px]">
                        <div>Location: <span className="text-cyan-300 font-bold">{tc.result?.city}</span></div>
                        <div>Temp: <span className="text-cyan-300 font-bold">{tc.result?.temp}°C</span> ({tc.result?.condition})</div>
                        <div>Humidity: <span className="text-cyan-300 font-bold">{tc.result?.humidity}%</span></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Assistant Controls Bar */}
            {msg.role === 'assistant' && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="text-cyan-500">
                    {msg.modelUsed ? `Model: ${msg.modelUsed}` : 'Gemini 3.8 Flash'}
                  </span>
                </div>
                <button
                  onClick={() => onPlaySpeech(msg.id, msg.content)}
                  className="flex items-center space-x-1 text-slate-400 hover:text-cyan-300 transition-colors p-1 rounded hover:bg-slate-800 cursor-pointer"
                  title="Play neural voice synthesis"
                >
                  <Volume2 className={`w-3.5 h-3.5 ${playingAudioId === msg.id ? 'text-cyan-400 animate-pulse' : ''}`} />
                  <span>{playingAudioId === msg.id ? 'Speaking...' : 'Play Audio'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
