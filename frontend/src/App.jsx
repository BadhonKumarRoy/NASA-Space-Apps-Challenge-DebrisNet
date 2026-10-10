import React, { useState, useEffect } from 'react';
import HeaderHUD from './components/HeaderHUD';
import ControlPanel from './components/ControlPanel';
import ConjunctionFeed from './components/ConjunctionFeed';
import GlobeViewer from './components/GlobeViewer';
import { fetchHealth, screenConjunctions, calculateManeuver, fetchNasaLiveData } from './services/api';

export default function App() {
  // Simulation Controls State
  const [isPlaying, setIsPlaying] = useState(true);
  const [simSpeed, setSimSpeed] = useState(25);
  const [thresholdKm, setThresholdKm] = useState(12.0);
  const [layers, setLayers] = useState({
    orbits: true,
    debris: true,
    grid: true,
    labels: true,
  });

  // Telemetry & Conjunction State
  const [trackedCount, setTrackedCount] = useState(1420);
  const [missDistance, setMissDistance] = useState(1.48);
  const [probCollision, setProbCollision] = useState(3.84e-3);
  const [reqDeltaV, setReqDeltaV] = useState(0.42);
  const [isManeuverDone, setIsManeuverDone] = useState(false);
  const [isKesslerActive, setIsKesslerActive] = useState(false);
  const [cameraFocusTarget, setCameraFocusTarget] = useState(null);
  const [isBackendConnected, setIsBackendConnected] = useState(false);

  const [alertsList, setAlertsList] = useState([
    { time: '14:22:04 UTC', pair: 'ISS ⚡ COSMOS-2251', distance: '1.48 km', status: 'CRITICAL' },
    { time: '13:58:19 UTC', pair: 'STARLINK-3120 ⚡ FENGYUN-1C', distance: '6.82 km', status: 'MONITORING' },
    { time: '12:40:11 UTC', pair: 'SENTINEL-1A ⚡ CZ-4 DEB', distance: '11.4 km', status: 'NOMINAL' },
  ]);

  // Ping Python FastAPI Health
  useEffect(() => {
    async function checkBackend() {
      const health = await fetchHealth();
      if (health && health.status === 'ONLINE') {
        setIsBackendConnected(true);
        if (health.tracked_objects) {
          setTrackedCount(health.tracked_objects);
        }
      } else {
        setIsBackendConnected(false);
      }
    }
    checkBackend();
    const timer = setInterval(checkBackend, 10000);
    return () => clearInterval(timer);
  }, []);

  // Telemetry update from 3D Engine
  const handleTelemetryUpdate = (data) => {
    setMissDistance(data.distKm);
    setProbCollision(data.Pc);
    if (!isManeuverDone) {
      setReqDeltaV(data.reqDeltaV);
    }
  };

  // Maneuver Execution
  const handleExecuteManeuver = async () => {
    setIsManeuverDone(true);
    setReqDeltaV(0);

    // Call Python backend optimization endpoint
    const plan = await calculateManeuver({
      current_miss_km: missDistance,
      desired_miss_km: 25.0,
      time_to_closest_approach_sec: 1800.0,
    });

    if (plan && plan.required) {
      console.log('Maneuver executed via FastAPI CW engine:', plan);
    }

    setAlertsList((prev) =>
      prev.map((item, idx) => (idx === 0 ? { ...item, distance: '26.4 km', status: 'RESOLVED' } : item))
    );
  };

  // Kessler Syndrome Cascade Trigger
  const handleTriggerKessler = () => {
    setIsKesslerActive(true);
    setTrackedCount((prev) => prev + 300);
  };

  // Sync NASA Live Feed
  const [isNasaSyncing, setIsNasaSyncing] = useState(false);
  const handleSyncNasa = async () => {
    setIsNasaSyncing(true);
    const result = await fetchNasaLiveData('active', 150);
    if (result && result.ingested_objects) {
      setTrackedCount(result.ingested_objects);
    }
    setTimeout(() => setIsNasaSyncing(false), 1200);
  };

  // Camera Reset
  const handleResetCamera = () => {
    setCameraFocusTarget(null);
  };

  const handleFocusThreat = () => {
    setCameraFocusTarget(Date.now());
  };

  return (
    <div className="relative w-screen h-screen flex flex-col justify-between overflow-hidden bg-[#030712]">
      {/* 3D Three.js Globe Canvas */}
      <GlobeViewer
        isPlaying={isPlaying}
        simSpeed={simSpeed}
        thresholdKm={thresholdKm}
        layers={layers}
        isManeuverDone={isManeuverDone}
        isKesslerActive={isKesslerActive}
        onTelemetryUpdate={handleTelemetryUpdate}
        cameraFocusTarget={cameraFocusTarget}
      />

      {/* Top Header HUD */}
      <HeaderHUD
        trackedCount={trackedCount}
        activeConjunctions={!isManeuverDone && missDistance <= thresholdKm ? 1 : 0}
        peakPc={isManeuverDone ? 1.2e-8 : probCollision}
        isBackendConnected={isBackendConnected}
      />

      {/* Main Operational Viewports Overlay */}
      <div className="relative z-10 flex-1 flex justify-between items-center px-6 pointer-events-none">
        {/* Left Side Control Panel */}
        <div className="pointer-events-auto">
          <ControlPanel
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            simSpeed={simSpeed}
            setSimSpeed={setSimSpeed}
            thresholdKm={thresholdKm}
            setThresholdKm={setThresholdKm}
            layers={layers}
            setLayers={setLayers}
            onResetCamera={handleResetCamera}
            onExecuteManeuver={handleExecuteManeuver}
            isManeuverDone={isManeuverDone}
            onTriggerKessler={handleTriggerKessler}
            onSyncNasa={handleSyncNasa}
            isNasaSyncing={isNasaSyncing}
          />
        </div>

        {/* Right Side Conjunction Threat Feed */}
        <div className="pointer-events-auto">
          <ConjunctionFeed
            missDistance={missDistance}
            probCollision={probCollision}
            reqDeltaV={reqDeltaV}
            isManeuverDone={isManeuverDone}
            onFocusThreat={handleFocusThreat}
            alertsList={alertsList}
            thresholdKm={thresholdKm}
          />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="relative z-10 w-full px-6 py-2.5 hud-glass border-b-0 border-x-0 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <span className="text-slate-200">Active Satellite</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
            <span className="text-slate-200">Tracked Debris Fragment</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span className="text-slate-200">Mitigated Orbit Corridor</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-slate-300">
          <span>
            Data Source: <strong className="text-emerald-400 font-mono">CelesTrak / NASA ODPO</strong>
          </span>
          <span>|</span>
          <span>
            API Mode: <strong className="text-cyan-400 font-mono">React 18 + Three.js + FastAPI</strong>
          </span>
        </div>
      </footer>
    </div>
  );
}
