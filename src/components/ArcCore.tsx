import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, Cpu, Zap, Activity } from 'lucide-react';

interface ArcCoreProps {
  status: 'IDLE' | 'LISTENING' | 'COMPUTING' | 'SPEAKING';
  commanderTitle: string;
  onCommanderTitleChange: (title: string) => void;
  onVoiceDirective: (transcript: string) => void;
  voicePitchHz: number;
  setVoicePitchHz: (hz: number) => void;
}

export const ArcCore: React.FC<ArcCoreProps> = ({
  status,
  commanderTitle,
  onCommanderTitleChange,
  onVoiceDirective,
  voicePitchHz,
  setVoicePitchHz
}) => {
  const [isMicActive, setIsMicActive] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Setup Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }

        if (final && final.trim()) {
          setInterimTranscript('');
          onVoiceDirective(final.trim());
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition warning:', err);
      };

      recognition.onend = () => {
        if (isMicActive) {
          try {
            recognition.start();
          } catch {
            // Already active
          }
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      stopAudioAnalysis();
    };
  }, [isMicActive, onVoiceDirective]);

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);

      const detectPitchAndVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buffer);

        // Compute RMS volume
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);
        const level = Math.min(100, Math.round(rms * 400));
        setAudioLevel(level);

        // Basic Pitch Autocorrelation if above noise threshold
        if (rms > 0.02) {
          let bestOffset = -1;
          let bestCorrelation = 0;
          const sampleRate = audioCtx.sampleRate;
          const minSamples = Math.floor(sampleRate / 350); // ~350Hz upper limit
          const maxSamples = Math.floor(sampleRate / 75);  // ~75Hz lower limit

          for (let offset = minSamples; offset <= maxSamples; offset++) {
            let correlation = 0;
            for (let i = 0; i < buffer.length - offset; i++) {
              correlation += buffer[i] * buffer[i + offset];
            }
            if (correlation > bestCorrelation) {
              bestCorrelation = correlation;
              bestOffset = offset;
            }
          }

          if (bestOffset > 0) {
            const detectedPitch = Math.round(sampleRate / bestOffset);
  if (detectedPitch >= 75 && detectedPitch <= 350) {
    setVoicePitchHz(detectedPitch);
  }
          }
        }

        animFrameRef.current = requestAnimationFrame(detectPitchAndVolume);
      };

      detectPitchAndVolume();
    } catch (err) {
      console.warn('Microphone access denied or audio context failed:', err);
    }
  };

  const stopAudioAnalysis = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const toggleMic = () => {
    if (isMicActive) {
      setIsMicActive(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      stopAudioAnalysis();
    } else {
      setIsMicActive(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn('Failed to start speech recognition:', e);
        }
      }
      startAudioAnalysis();
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-6 bg-slate-900/40 border border-cyan-500/20 rounded-2xl backdrop-blur-md overflow-hidden">
      {/* Background radial glow */}
      <div className={`absolute -inset-10 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700 ${
        status === 'SPEAKING' ? 'bg-cyan-400 opacity-40 scale-110' :
        status === 'COMPUTING' ? 'bg-amber-400 opacity-30 animate-pulse' :
        status === 'LISTENING' ? 'bg-emerald-400 opacity-35' : 'bg-cyan-600'
      }`} />

      {/* Holographic Header Bar */}
      <div className="w-full flex items-center justify-between mb-4 border-b border-cyan-500/10 pb-2">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-cyan-300">
            Holographic Arc Core
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="font-mono text-[10px] text-slate-400">STATE:</span>
          <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
            status === 'SPEAKING' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 glow-cyan-sm' :
            status === 'COMPUTING' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 glow-amber' :
            status === 'LISTENING' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
            'bg-slate-800 text-slate-300 border border-slate-700'
          }`}>
            {status}
          </span>
        </div>
      </div>

      {/* The Central Visual Holographic Orb */}
      <div className="relative w-52 h-52 flex items-center justify-center my-3">
        {/* Outer Rotating Dash Ring */}
        <div
          className={`absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/30 transition-all duration-1000 ${
            status === 'COMPUTING' ? 'animate-spin border-amber-400/50' : 'animate-[spin_20s_linear_infinite]'
          }`}
        />

        {/* Middle Pulsing Ring */}
        <div
          className={`absolute inset-3 rounded-full border border-cyan-400/40 transition-transform duration-300 ${
            status === 'LISTENING' ? 'scale-105 border-emerald-400' : ''
          }`}
          style={{
            transform: isMicActive ? `scale(${1 + audioLevel * 0.003})` : undefined
          }}
        />

        {/* Counter-rotating segmented ring */}
        <div
          className="absolute inset-7 rounded-full border-t-2 border-b-2 border-cyan-300/60 animate-[spin_12s_linear_infinite_reverse]"
        />

        {/* Inner Glowing Core Button */}
        <button
          onClick={toggleMic}
          aria-label={isMicActive ? "Deactivate voice standby" : "Activate voice standby"}
          className={`relative z-10 w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${
            isMicActive
              ? 'bg-cyan-500/20 border-2 border-cyan-400 glow-cyan text-cyan-200'
              : 'bg-slate-950/80 border border-cyan-500/30 text-slate-400 hover:border-cyan-400/70 hover:text-cyan-300'
          }`}
        >
          {isMicActive ? (
            <>
              <Mic className="w-8 h-8 text-cyan-300 animate-pulse mb-1" />
              <span className="font-mono text-[10px] tracking-widest text-cyan-200 uppercase font-semibold">
                Listening
              </span>
            </>
          ) : (
            <>
              <MicOff className="w-7 h-7 text-slate-400 mb-1" />
              <span className="font-mono text-[9px] tracking-wider text-slate-400 uppercase">
                Tap for Voice
              </span>
            </>
          )}

          {/* Dynamic Audio Waves Ring when speaking */}
          {isMicActive && (
            <div
              className="absolute -inset-2 rounded-full border border-cyan-400/40 pointer-events-none animate-ping"
              style={{ animationDuration: '2s' }}
            />
          )}
        </button>
      </div>

      {/* Live Interim Transcript or Directive Prompt */}
      {interimTranscript ? (
        <div className="w-full bg-cyan-950/40 border border-cyan-500/40 rounded-lg p-2.5 my-2 text-center animate-fade-in">
          <span className="font-mono text-[10px] text-cyan-400 uppercase block mb-1">
            Real-time Acoustic Stream:
          </span>
          <p className="font-sans text-xs text-cyan-100 italic">
            "{interimTranscript}"
          </p>
        </div>
      ) : (
        <div className="text-center my-2">
          <p className="font-mono text-xs text-slate-400">
            {isMicActive ? 'Listening for commander directive...' : 'Hands-free voice recognition ready'}
          </p>
        </div>
      )}

      {/* Acoustic Frequency & Gender Classification Telemetry */}
      <div className="w-full grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800 text-xs font-mono">
        <div className="bg-slate-950/50 p-2 rounded border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">PITCH (F0):</span>
          <span className="text-cyan-300 font-semibold">
            {voicePitchHz > 0 ? `${voicePitchHz} Hz` : 'Calibrated'}
          </span>
        </div>
        <div className="bg-slate-950/50 p-2 rounded border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400">ADDRESS AS:</span>
          <button
            onClick={() => onCommanderTitleChange(commanderTitle === 'Operator' ? 'Commander' : 'Operator')}
            className="text-cyan-300 hover:text-cyan-100 font-semibold underline underline-offset-2 cursor-pointer flex items-center space-x-1"
            title="Click to switch between Operator and Commander"
          >
            <span>{commanderTitle}</span>
            <span className="text-[10px] text-slate-400 font-normal">(auto)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
