import React, { useState } from 'react';
import { Terminal, ShieldAlert, CheckCircle, Play, X, Trash2 } from 'lucide-react';

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRunCommand: (command: string) => Promise<any>;
}

export const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  isOpen,
  onClose,
  onRunCommand
}) => {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<Array<{ cmd: string; output: string; status: 'success' | 'blocked' | 'error' }>>([
    {
      cmd: 'Get-ExecutionPolicy',
      output: 'RemoteSigned - Atlas security rails active.',
      status: 'success'
    }
  ]);
  const [isRunning, setIsRunning] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || isRunning) return;

    const currentCmd = command.trim();
    setCommand('');
    setIsRunning(true);

    try {
      const res = await onRunCommand(currentCmd);
      setHistory(prev => [
        ...prev,
        {
          cmd: currentCmd,
          output: res?.stdout || res?.error || res?.message || 'Execution completed.',
          status: res?.status === 'blocked' ? 'blocked' : res?.status === 'error' ? 'error' : 'success'
        }
      ]);
    } catch (err: any) {
      setHistory(prev => [
        ...prev,
        {
          cmd: currentCmd,
          output: err.message || 'Execution failed.',
          status: 'error'
        }
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-950 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[600px]">
        {/* Terminal Title Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-cyan-500/20">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-xs uppercase tracking-wider text-cyan-300 font-semibold">
              Atlas Windows Security Shell (PowerShell Core)
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setHistory([])}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1"
              title="Clear terminal buffer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-red-400 transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Security rails banner */}
        <div className="bg-cyan-950/40 px-4 py-2 border-b border-cyan-500/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="text-cyan-400">Security blocklist active: rmdir /s /q, format, diskpart intercepted</span>
          <span className="text-emerald-400 font-semibold">FAILSAFE: ENABLED</span>
        </div>

        {/* Output Stream */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-3 bg-black/90">
          {history.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center space-x-2 text-cyan-400">
                <span>PS C:\Atlas&gt;</span>
                <span className="text-slate-200 font-semibold">{item.cmd}</span>
                {item.status === 'blocked' && (
                  <span className="bg-red-950/80 text-red-400 text-[10px] px-1.5 py-0.2 rounded border border-red-500/40 flex items-center space-x-1">
                    <ShieldAlert className="w-3 h-3" />
                    <span>BLOCKED</span>
                  </span>
                )}
                {item.status === 'success' && (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                )}
              </div>
              <pre
                className={`p-2 rounded text-[11px] whitespace-pre-wrap ${
                  item.status === 'blocked'
                    ? 'bg-red-950/30 text-red-300 border border-red-500/20'
                    : item.status === 'error'
                    ? 'bg-amber-950/30 text-amber-300 border border-amber-500/20'
                    : 'text-slate-300'
                }`}
              >
                {item.output}
              </pre>
            </div>
          ))}
          {isRunning && (
            <div className="flex items-center space-x-2 text-cyan-400 animate-pulse">
              <span>PS C:\Atlas&gt;</span>
              <span>Executing directive...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="p-3 bg-slate-900 border-t border-cyan-500/20 flex items-center space-x-2">
          <span className="font-mono text-cyan-400 text-xs pl-2">PS C:\Atlas&gt;</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Try: dir, ipconfig, get_system_specs, or custom PowerShell command..."
            className="flex-1 bg-black/60 border border-cyan-500/30 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={!command.trim() || isRunning}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-mono text-xs font-semibold rounded-lg flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>RUN</span>
          </button>
        </form>
      </div>
    </div>
  );
};
