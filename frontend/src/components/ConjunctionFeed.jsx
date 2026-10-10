import React from 'react';
import { AlertTriangle, Focus, Calculator } from 'lucide-react';

export default function ConjunctionFeed({
  missDistance,
  probCollision,
  reqDeltaV,
  isManeuverDone,
  onFocusThreat,
  alertsList,
  thresholdKm = 12.0,
}) {
  const isCritical = !isManeuverDone && missDistance <= thresholdKm;

  return (
    <aside className="w-96 p-4 rounded-xl hud-glass shadow-2xl flex flex-col space-y-4 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isCritical ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`}></div>
          <h3 className="text-sm font-bold text-slate-200">Live Conjunction Threat Audit</h3>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
          isCritical ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
        }`}>
          {isCritical ? 'PRIORITY 1 CRITICAL' : 'NOMINAL CORRIDOR'}
        </span>
      </div>

      {/* Active High-Risk Event Card */}
      <div className={`rounded-xl p-3 space-y-3 transition-all duration-300 ${
        isCritical
          ? 'bg-red-950/70 border border-red-600/70 shadow-[0_0_20px_rgba(239,68,68,0.25)]'
          : 'bg-emerald-950/40 border border-emerald-700/50'
      }`}>
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {isManeuverDone ? 'CONJUNCTION MITIGATED' : 'CONJUNCTION ALERT'}
            </span>
            <h4 className="text-sm font-black text-white font-mono mt-0.5">
              ISS (ZARYA) ⚡ COSMOS-2251 DEB
            </h4>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded font-bold font-mono ${
            isManeuverDone ? 'bg-emerald-700 text-white' : 'bg-red-600 text-white animate-pulse'
          }`}>
            {isManeuverDone ? 'RESOLVED' : 'TCA: -04m 12s'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-black/50 border border-slate-800">
            <div className="text-[10px] text-slate-400">Miss Distance ($d_{'{min}'}$)</div>
            <div className={`text-base font-bold font-mono ${isCritical ? 'text-red-300' : 'text-emerald-300'}`}>
              {missDistance.toFixed(2)} km
            </div>
          </div>
          <div className="p-2 rounded bg-black/50 border border-slate-800">
            <div className="text-[10px] text-slate-400">Probability ($P_c$)</div>
            <div className={`text-base font-bold font-mono ${isCritical ? 'text-red-400' : 'text-emerald-400'}`}>
              {isManeuverDone ? '1.20 × 10⁻⁸' : (probCollision >= 1e-4 ? probCollision.toExponential(2) : '< 1.0e-5')}
            </div>
          </div>
          <div className="p-2 rounded bg-black/50 border border-slate-800">
            <div className="text-[10px] text-slate-400">Rel Velocity ($v_{'{rel}'}$)</div>
            <div className="text-sm font-bold font-mono text-slate-200">14.28 km/s</div>
          </div>
          <div className="p-2 rounded bg-black/50 border border-slate-800">
            <div className="text-[10px] text-slate-400">Required Impulse (Δv)</div>
            <div className="text-sm font-bold font-mono text-emerald-400">
              {isManeuverDone ? '0.00 m/s (Done)' : `${reqDeltaV.toFixed(2)} m/s`}
            </div>
          </div>
        </div>

        <button
          onClick={onFocusThreat}
          className="w-full py-1.5 px-3 rounded bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition"
        >
          <Focus className="w-3.5 h-3.5 text-cyan-400" />
          <span>Focus Camera on Conjunction Zone</span>
        </button>
      </div>

      {/* Math formulation HUD */}
      <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/60 space-y-2 text-xs">
        <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5 text-cyan-400" />
          <span>Encounter B-Plane Math Model</span>
        </div>
        <div className="p-2 rounded bg-black/60 font-mono text-[11px] text-cyan-300 leading-relaxed border border-cyan-950">
          P_c = (r_A² / 2σ_xσ_y) · exp(-0.5[(x₀/σ_x)² + (y₀/σ_y)²])<br />
          Δv = Δr_req / (3 · n · Δt_burn) [CW Model]
        </div>
      </div>

      {/* Conjunction Alerts History */}
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-slate-300">Monitored Conjunction Events:</span>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {alertsList.map((a, idx) => (
            <div
              key={idx}
              className={`p-2 rounded bg-slate-900/80 border flex items-center justify-between text-[11px] ${
                a.status === 'CRITICAL' && !isManeuverDone ? 'border-red-600/70' : 'border-slate-800'
              }`}
            >
              <div>
                <div className="font-bold font-mono text-slate-200">{a.pair}</div>
                <div className="text-[10px] text-slate-400">
                  Time: {a.time} • Miss: <span className="font-mono text-cyan-300">{a.distance}</span>
                </div>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                a.status === 'CRITICAL' && !isManeuverDone
                  ? 'bg-red-950 text-red-300 border border-red-800'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {isManeuverDone && idx === 0 ? 'RESOLVED' : a.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
