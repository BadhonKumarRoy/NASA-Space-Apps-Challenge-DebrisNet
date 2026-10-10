import React from 'react';
import { Play, Pause, RotateCcw, Zap, Flame, Eye, Settings2, CloudDownload } from 'lucide-react';

export default function ControlPanel({
  isPlaying,
  setIsPlaying,
  simSpeed,
  setSimSpeed,
  thresholdKm,
  setThresholdKm,
  layers,
  setLayers,
  onResetCamera,
  onExecuteManeuver,
  isManeuverDone,
  onTriggerKessler,
  onSyncNasa,
  isNasaSyncing,
}) {
  return (
    <aside className="w-80 p-4 rounded-xl hud-glass shadow-2xl flex flex-col space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-cyan-400" />
          Mission Controls
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700 font-mono">
          Epoch: UTC
        </span>
      </div>

      {/* Simulation Speed & Playback */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-300">Time Warp Speed:</span>
          <span className="text-cyan-300 font-mono font-bold">{simSpeed}x</span>
        </div>
        <input
          type="range"
          min="1"
          max="120"
          value={simSpeed}
          onChange={(e) => setSimSpeed(Number(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
        />
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
              isPlaying
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPlaying ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={onResetCamera}
            className="py-1.5 px-3 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold border border-slate-600 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset View
          </button>
        </div>
      </div>

      {/* Screening Threshold */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-300">Screening Threshold ($d_{'{min}'}$):</span>
          <span className="text-amber-400 font-mono font-bold">{thresholdKm.toFixed(1)} km</span>
        </div>
        <input
          type="range"
          min="3"
          max="30"
          step="0.5"
          value={thresholdKm}
          onChange={(e) => setThresholdKm(Number(e.target.value))}
          className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
        />
        <p className="text-[11px] text-slate-400 leading-tight">
          KD-Tree filters all objects within this proximity radius.
        </p>
      </div>

      {/* Layer Toggles */}
      <div className="space-y-2 border-t border-slate-700/60 pt-3">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
          <Eye className="w-3.5 h-3.5 text-slate-400" /> Layer Visibility:
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.keys(layers).map((layer) => (
            <label key={layer} className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white capitalize">
              <input
                type="checkbox"
                checked={layers[layer]}
                onChange={(e) => setLayers({ ...layers, [layer]: e.target.checked })}
                className="accent-cyan-400 rounded"
              />
              <span>{layer}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Autonomous Collision Avoidance Maneuver Button */}
      <div className="space-y-2 border-t border-slate-700/60 pt-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-slate-200">Maneuver Optimizer (Δv)</span>
          <span className="text-[10px] text-emerald-400 font-mono">CW Hill Model</span>
        </div>
        <button
          onClick={onExecuteManeuver}
          disabled={isManeuverDone}
          className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 shadow-lg transition ${
            isManeuverDone
              ? 'bg-slate-800 text-emerald-400 border border-emerald-700 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950 cursor-pointer'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>{isManeuverDone ? '✓ Maneuver Burn Executed' : 'Execute Avoidance Burn (Δv)'}</span>
        </button>
        <p className="text-[11px] text-slate-400">
          {isManeuverDone
            ? 'Satellite safely shifted by +18 km altitude. Risk mitigated.'
            : 'Calculates minimum-fuel prograde impulsive burn to avoid debris.'}
        </p>
      </div>

      {/* NASA Open Data & CelesTrak Ingestion */}
      <div className="space-y-2 border-t border-slate-700/60 pt-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-cyan-300">NASA / Space-Track Ingest</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
            ODPO ORDEM 3.1
          </span>
        </div>
        <button
          onClick={onSyncNasa}
          disabled={isNasaSyncing}
          className="w-full py-2 px-3 rounded-lg bg-blue-950/70 hover:bg-blue-900/80 border border-blue-700/80 text-cyan-200 font-bold text-xs flex items-center justify-center space-x-2 transition"
        >
          <CloudDownload className={`w-4 h-4 text-cyan-400 ${isNasaSyncing ? 'animate-bounce' : ''}`} />
          <span>{isNasaSyncing ? 'Ingesting NASA Ephemeris...' : 'Sync Live NASA / CelesTrak Feed'}</span>
        </button>
        <p className="text-[11px] text-slate-400">
          Streams real-time Two-Line Element (TLE) satellite and debris catalogs into the SGP4 pipeline.
        </p>
      </div>

      {/* Kessler Syndrome Simulation Trigger */}
      <div className="space-y-2 border-t border-slate-700/60 pt-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-red-300">Kessler Cascade Simulator</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
            Pitch USP
          </span>
        </div>
        <button
          onClick={onTriggerKessler}
          className="w-full py-2 px-3 rounded-lg bg-red-950/70 hover:bg-red-900 border border-red-700/80 text-red-200 font-bold text-xs flex items-center justify-center space-x-2 transition"
        >
          <Flame className="w-4 h-4 text-red-500 animate-pulse" />
          <span>Simulate Orbital Impact Cascade</span>
        </button>
        <p className="text-[11px] text-slate-400">
          Demonstrates hypervelocity fragmentation chaining across the LEO shell.
        </p>
      </div>
    </aside>
  );
}
