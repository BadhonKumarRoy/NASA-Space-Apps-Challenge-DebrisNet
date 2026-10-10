import React from 'react';
import { Activity, ShieldAlert, Satellite, Radio } from 'lucide-react';

export default function HeaderHUD({ trackedCount, activeConjunctions, peakPc, isBackendConnected }) {
  return (
    <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between hud-glass border-t-0 border-x-0">
      <div className="flex items-center space-x-3">
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl font-black tracking-wider text-cyan-400">DebrisNet</span>
            <span className={`px-2 py-0.5 text-xs rounded border flex items-center gap-1.5 ${
              isBackendConnected 
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}>
              <Radio className="w-3 h-3 animate-pulse" />
              {isBackendConnected ? 'FastAPI Connected' : 'Local Astrodynamics'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Space Domain Awareness (SDA) & Real-time Collision Avoidance
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3 text-xs">
        <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex flex-col">
          <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
            <Satellite className="w-2.5 h-2.5 text-cyan-400" /> Tracked Objects
          </span>
          <span className="text-slate-100 font-mono font-bold text-sm">
            {trackedCount.toLocaleString()} obj
          </span>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex flex-col">
          <span className="text-slate-400 text-[10px] uppercase font-bold">Screening Engine</span>
          <span className="text-cyan-300 font-mono font-bold text-sm">
            3D cKD-Tree (O(N log N))
          </span>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex flex-col">
          <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
            <ShieldAlert className="w-2.5 h-2.5 text-amber-400" /> Conjunctions
          </span>
          <span className={`font-mono font-bold text-sm ${activeConjunctions > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {activeConjunctions} Detected
          </span>
        </div>

        <div className="px-3 py-1.5 rounded-lg bg-red-950/70 border border-red-700/60 flex flex-col shadow-[0_0_15px_rgba(239,68,68,0.3)]">
          <span className="text-red-300 text-[10px] uppercase font-bold">Max Probability (Pc)</span>
          <span className="text-red-400 font-mono font-bold text-sm">
            {peakPc > 1e-4 ? peakPc.toExponential(2) : '< 1.0e-5'}
          </span>
        </div>
      </div>
    </header>
  );
}
