import React from 'react';
import { Cloud, CloudRain, Sun, Wind, Droplets, MapPin, RefreshCw } from 'lucide-react';
import { WeatherData } from '../types';

interface WeatherWidgetProps {
  weather: WeatherData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  weather,
  isLoading,
  onRefresh
}) => {
  const getWeatherIcon = (cond: string) => {
    const c = cond?.toLowerCase() || '';
    if (c.includes('rain') || c.includes('drizzle')) return <CloudRain className="w-5 h-5 text-cyan-400" />;
    if (c.includes('cloud')) return <Cloud className="w-5 h-5 text-slate-300" />;
    return <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />;
  };

  return (
    <div className="bg-slate-900/40 border border-cyan-500/20 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-cyan-300">
            Atmospheric Telemetry
          </h3>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="text-slate-400 hover:text-cyan-300 transition-colors p-1 rounded hover:bg-cyan-950/40 cursor-pointer disabled:opacity-50"
          title="Refresh atmospheric telemetry"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* Main Temp & Condition */}
      <div className="flex items-center justify-between my-2">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-cyan-950/50 border border-cyan-500/30 rounded-xl">
            {getWeatherIcon(weather?.condition || 'Clear')}
          </div>
          <div>
            <div className="flex items-baseline space-x-1">
              <span className="text-3xl font-cyber font-bold text-slate-100">
                {weather?.temp !== undefined ? `${weather.temp}°` : '24°'}
              </span>
              <span className="text-xs font-mono text-cyan-400">C</span>
            </div>
            <p className="text-xs font-mono text-slate-400 capitalize">
              {weather?.description || weather?.condition || 'Clear Sky'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="font-cyber font-semibold text-sm text-cyan-200 block">
            {weather?.city || 'San Francisco'}
          </span>
          <span className="text-[10px] font-mono text-slate-400 block">
            {weather?.country || 'US'} · Live IP-Geo
          </span>
        </div>
      </div>

      {/* Sub-metrics */}
      <div className="grid grid-cols-2 gap-2 my-3 text-xs font-mono">
        <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 flex items-center space-x-2">
          <Droplets className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">HUMIDITY:</span>
          <span className="text-slate-200 font-semibold">{weather?.humidity ?? 65}%</span>
        </div>
        <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800 flex items-center space-x-2">
          <Wind className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">WIND:</span>
          <span className="text-slate-200 font-semibold">{weather?.wind_speed ?? 4.2} m/s</span>
        </div>
      </div>

      {/* 5-Day Mini Forecast Strip */}
      <div className="border-t border-slate-800/80 pt-3">
        <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider block mb-2">
          5-Day Predictive Atmospheric Trajectory
        </span>
        <div className="grid grid-cols-5 gap-1.5 text-center font-mono">
          {(weather?.forecast && weather.forecast.length > 0 ? weather.forecast : [
            { day: 'WED', temp: 24, condition: 'Clear' },
            { day: 'THU', temp: 25, condition: 'Clouds' },
            { day: 'FRI', temp: 23, condition: 'Clear' },
            { day: 'SAT', temp: 24, condition: 'Clear' },
            { day: 'SUN', temp: 22, condition: 'Clouds' },
          ]).map((fc, idx) => (
            <div key={idx} className="bg-slate-950/40 p-1.5 rounded border border-slate-800/60">
              <span className="text-[9px] text-slate-400 block font-semibold">{fc.day}</span>
              <span className="text-xs text-cyan-300 font-bold block my-0.5">{fc.temp}°</span>
              <span className="text-[8px] text-slate-400 block truncate">{fc.condition}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
