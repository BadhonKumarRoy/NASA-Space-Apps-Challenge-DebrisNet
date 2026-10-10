# 🛰️ DebrisNet — Space Domain Awareness Platform

> **Real-time orbital conjunction detection, collision probability computation, and autonomous avoidance maneuver planning — powered by NASA/CelesTrak live TLE data, SGP4 propagation, and an interactive 3D Three.js globe.**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python) ![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi) ![Three.js](https://img.shields.io/badge/Three.js-r165-black?logo=three.js) ![License](https://img.shields.io/badge/License-MIT-green)

---

## 🌍 What Is This?

DebrisNet is a **Space Domain Awareness (SDA)** web platform that:

- **Tracks** active satellites and debris fragments in real-time using SGP4 orbital mechanics
- **Screens** all object pairs for conjunction threats using a 3D cKD-Tree (O(N log N))
- **Computes** collision probability (Pc) using the Foster-1992 2D B-plane Gaussian model (NASA CARA standard)
- **Plans** minimum-fuel avoidance maneuvers using Hill-Clohessy-Wiltshire (CW) equations + Tsiolkovsky rocket equation
- **Visualizes** the full LEO environment in an interactive Three.js 3D globe with live labels, orbit rings, and debris cloud
- **Simulates** the Kessler Syndrome cascade scenario for demo/educational purposes
- **Ingests** live Two-Line Element (TLE) data directly from **NASA/CelesTrak** ephemeris feeds

---

## 🏗️ Architecture

```
debrisnet/
├── app/                          # Python FastAPI Backend
│   ├── main.py                   # API routes & WebSocket telemetry stream
│   ├── engine/
│   │   ├── sgp4_pipeline.py      # SGP4 propagation engine (vectorized)
│   │   ├── collision_risk.py     # Foster-1992 Pc B-plane computation
│   │   └── maneuver_planner.py   # CW + Tsiolkovsky maneuver optimizer
│   └── services/
│       └── nasa_client.py        # Live NASA/CelesTrak TLE & ODPO ORDEM fetcher
├── frontend/                     # React 18 + Vite + Tailwind + Three.js
│   └── src/
│       ├── App.jsx               # Root state manager
│       ├── components/
│       │   ├── GlobeViewer.jsx   # Three.js 3D scene (single useEffect, ref-based)
│       │   ├── ConjunctionFeed.jsx
│       │   ├── ControlPanel.jsx
│       │   └── HeaderHUD.jsx
│       └── services/
│           └── api.js            # FastAPI + WebSocket client
├── requirements.txt              # Python dependencies
├── docker-compose.yml            # Full stack container setup
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm 9+

### 1. Backend (FastAPI)

```bash
cd debrisnet

# Install Python dependencies
pip install -r requirements.txt

# Start FastAPI server
uvicorn app.main:app --reload --port 8000
```

Backend will be live at: `http://localhost:8000`
API docs (Swagger): `http://localhost:8000/docs`

### 2. Frontend (React + Vite)

```bash
# From project root
npm run dev

# Or from frontend/ directory
cd frontend && npm install && npm run dev
```

Frontend will be live at: `http://localhost:3000`

### 3. Docker (Full Stack)

```bash
docker-compose up --build
```

---

## 🔬 Science & Algorithms

### Collision Probability — Foster-1992 B-Plane Model

```
Pc = (r_A^2 / 2π·σx·σy) · exp(-0.5·[(x0/σx)^2 + (y0/σy)^2])
```

Where `r_A` is the combined hard-body radius (15m), `σx, σy` are the principal axis uncertainties from the combined covariance projected onto the encounter B-plane.

### Maneuver Planning — CW Hill Equations

```
Δv = Δr_req / (3 · n · Δt_TCA)
```

Where `n = sqrt(μ/a³)` is mean motion, `Δt_TCA` is time to closest approach.

### Fuel Budget — Tsiolkovsky Rocket Equation

```
m_fuel = m0 · (exp(Δv / Isp·g0) - 1)
```

---

## 📡 NASA Data Sources

| Source | Data | Endpoint |
|--------|------|----------|
| **CelesTrak** | Live TLE catalog (active satellites) | `celestrak.org/NORAD/elements/gp.php?GROUP=active` |
| **CelesTrak** | Fengyun-1C debris cloud | `celestrak.org/NORAD/elements/gp.php?GROUP=1982-092` |
| **NASA ODPO** | ORDEM 3.1 spatial density model | Hardcoded from published ORDEM 3.1 dataset |

---

## 🌐 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Backend status + tracked object count |
| `POST` | `/api/v1/tle/sync` | Ingest custom TLE records |
| `POST` | `/api/v1/screen` | Run conjunction screening (cKD-Tree) |
| `POST` | `/api/v1/maneuver/optimize` | Compute avoidance burn plan |
| `GET` | `/api/v1/nasa/fetch-live` | Pull live CelesTrak TLEs into SGP4 pipeline |
| `GET` | `/api/v1/nasa/odpo-density` | NASA ORDEM 3.1 debris density profile |
| `WS` | `/ws/telemetry` | Real-time 2Hz position stream (WebSocket) |

---

## 🎮 Features

- 🌍 **Interactive 3D Globe** — Drag, zoom, orbit. Click any satellite/debris for NORAD details
- ⚡ **Live Conjunction Alerts** — Real-time miss distance, Pc, and delta-v recommendations
- 🚀 **Autonomous Burn Executor** — One-click CW-optimized avoidance maneuver
- ☁️ **NASA Live Feed Sync** — Pull 150+ live TLEs from CelesTrak on demand
- 💥 **Kessler Cascade Demo** — Simulate hypervelocity fragmentation chain reaction
- 📊 **ODPO Density Profile** — LEO debris density by altitude band (NASA ORDEM 3.1)
- 🔴 **Layer Toggles** — Show/hide orbit rings, debris cloud, labels, grid

---

## 🏆 Built For

NASA Space Apps Challenge / Hackathon — demonstrating real astrodynamics integrated with modern web visualization for the **orbital safety** domain.

---

## 📄 License

MIT
