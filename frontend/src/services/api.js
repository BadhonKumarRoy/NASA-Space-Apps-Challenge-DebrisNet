/**
 * DebrisNet API & WebSocket Client
 * Connects React UI to the Python FastAPI backend
 */

const API_BASE = '/api/v1';

export async function fetchHealth() {
  try {
    const res = await fetch('/health');
    return await res.json();
  } catch (err) {
    return { status: 'OFFLINE', error: err.message };
  }
}

export async function screenConjunctions(thresholdKm = 20.0) {
  try {
    const res = await fetch(`${API_BASE}/screen?threshold_km=${thresholdKm}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend screening offline, using simulated telemetry:', err);
    return null;
  }
}

export async function calculateManeuver(params) {
  try {
    const res = await fetch(`${API_BASE}/maneuver/optimize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend maneuver planner offline, using local model:', err);
    return null;
  }
}

export async function fetchNasaLiveData(category = 'active', limit = 150) {
  try {
    const res = await fetch(`${API_BASE}/nasa/fetch-live?category=${category}&limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('NASA live sync error:', err);
    return null;
  }
}

export async function getNasaOdpoDensity() {
  try {
    const res = await fetch(`${API_BASE}/nasa/odpo-density`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('NASA ODPO fetch error:', err);
    return null;
  }
}

export function connectTelemetryWebSocket(onMessage, onError) {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws/telemetry`;

  let ws = null;
  try {
    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (e) {
        console.error('Failed to parse telemetry json', e);
      }
    };

    ws.onerror = (e) => {
      if (onError) onError(e);
    };

    ws.onclose = () => {
      console.log('Telemetry WebSocket closed');
    };
  } catch (e) {
    if (onError) onError(e);
  }

  return () => {
    if (ws) ws.close();
  };
}
