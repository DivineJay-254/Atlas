import React from 'react';
import { Cpu, HardDrive, Battery, RefreshCw, Zap, Server } from 'lucide-react';
import { SystemSpecs } from '../types';

interface TelemetryPanelProps {
  specs: SystemSpecs | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  specs,
  isLoading,
  onRefresh
}) => {
  const cpuPct = specs?.cpu?.usage_percent ?? 24;
  const ramPct = specs?.memory?.usage_percent ?? 33.4;
  const diskPct = specs?.disk?.usage_percent ?? 39.4;
  const batteryPct = specs?.battery?.percent ?? 94;

  return (
    <div className="bg-slate-900/40 border border-cyan-500/20 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-cyan-300">
            Workstation Telemetry
          </h3>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-slate-400 hover:text-cyan-300 transition-colors p-1 rounded hover:bg-cyan-950/40 cursor-pointer disabled:opacity-50"
          title="Refresh hardware telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Main Gauges Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* CPU Utilization */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span className="flex items-center space-x-1">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>CPU LOAD</span>
            </span>
            <span className="font-semibold text-cyan-300">{cpuPct}%</span>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                cpuPct > 80 ? 'bg-red-500' : cpuPct > 50 ? 'bg-amber-400' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, cpuPct))}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-1.5 truncate">
            {specs?.processor || '32-Core i9-13900K'}
          </span>
        </div>

        {/* RAM Usage */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span className="flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-blue-400" />
              <span>RAM</span>
            </span>
            <span className="font-semibold text-blue-300">{ramPct}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, ramPct))}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-1.5 truncate">
            {specs?.memory ? `${specs.memory.used_gb} GB / ${specs.memory.total_gb} GB` : '21.4 / 64.0 GB'}
          </span>
        </div>

        {/* Disk Space */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span className="flex items-center space-x-1">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>STORAGE (C:)</span>
            </span>
            <span className="font-semibold text-emerald-300">{diskPct}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, diskPct))}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-1.5 truncate">
            {specs?.disk ? `${specs.disk.free_gb} GB Free` : '1,240 GB Free'}
          </span>
        </div>

        {/* Battery Telemetry */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
            <span className="flex items-center space-x-1">
              <Battery className="w-3.5 h-3.5 text-amber-400" />
              <span>POWER</span>
            </span>
            <span className="font-semibold text-amber-300">{batteryPct}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, batteryPct))}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-slate-500 mt-1.5">
            {specs?.battery?.power_plugged !== false ? 'AC Connected (Online)' : 'Discharging'}
          </span>
        </div>
      </div>

      {/* Host System Metadata Footer */}
      <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span className="truncate max-w-[200px]">
          {specs?.os || 'Windows 11 Pro 64-bit'}
        </span>
        <span className="text-cyan-400 text-[10px] uppercase font-semibold">
          NOMINAL
        </span>
      </div>
    </div>
  );
};
