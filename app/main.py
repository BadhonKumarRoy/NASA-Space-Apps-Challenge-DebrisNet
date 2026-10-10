"""
DebrisNet Space Domain Awareness (SDA) Backend
FastAPI Real-time API & Conjunction Alert Server
"""
import asyncio
from datetime import datetime, timezone
from typing import List
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from scipy.spatial import cKDTree

from app.engine.sgp4_pipeline import SGP4Pipeline
from app.engine.collision_risk import compute_collision_probability_2d, default_leo_covariance
from app.engine.maneuver_planner import calculate_avoidance_maneuver
from app.services.nasa_client import NASADataService

app = FastAPI(
    title="DebrisNet SDA API",
    description="Real-time Orbital Safety, Conjunction Screening & Autonomous Maneuver Platform",
    version="1.0.0"
)

nasa_service = NASADataService()

# Enable CORS for frontend clients (React/Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = SGP4Pipeline()

# Sample TLE Data for initial bootstrap
SAMPLE_TLE_RECORDS = [
    {
        "id": "25544",
        "name": "ISS (ZARYA)",
        "line1": "1 25544U 98067A   24080.52187500  .00016717  00000+0  10270-3 0  9025",
        "line2": "2 25544  51.6416 114.7391 0004356  64.3214  45.8920 15.49815340445218"
    },
    {
        "id": "20580",
        "name": "HST (HUBBLE)",
        "line1": "1 20580U 90037B   24080.50000000  .00001200  00000+0  54000-4 0  9998",
        "line2": "2 20580  28.4690 270.1234 0002840  95.1200 265.1200 15.08000000889201"
    },
    {
        "id": "33749",
        "name": "COSMOS 2251 DEB",
        "line1": "1 33749U 93036PX  24080.45000000  .00005400  00000+0  21000-3 0  9992",
        "line2": "2 33749  51.6420 114.7400 0004500  64.2000  46.0000 15.49810000214502"
    }
]

# Bootstrap catalog on startup
pipeline.load_tle_catalog(SAMPLE_TLE_RECORDS)


# Pydantic Schemas
class TLERecord(BaseModel):
    id: str
    name: str
    line1: str
    line2: str


class ConjunctionAlert(BaseModel):
    object1_id: str
    object2_id: str
    distance_km: float
    collision_probability_pc: float
    recommended_delta_v_mps: float
    status: str


class ManeuverRequest(BaseModel):
    current_miss_km: float
    desired_miss_km: float = 25.0
    time_to_closest_approach_sec: float = 1800.0  # 30 mins
    orbit_semi_major_axis_km: float = 6778.0
    satellite_dry_mass_kg: float = 500.0


@app.get("/health")
def health_check():
    return {
        "status": "ONLINE",
        "platform": "DebrisNet SDA Engine",
        "tracked_objects": len(pipeline.satellites),
        "timestamp_utc": datetime.now(timezone.utc).isoformat()
    }


@app.post("/api/v1/tle/sync")
def sync_tle(records: List[TLERecord]):
    """
    CelesTrak / Space-Track থেকে নতুন TLE ডাটা ইনজেস্ট করে।
    """
    raw_dicts = [r.model_dump() for r in records]
    count = pipeline.load_tle_catalog(raw_dicts)
    return {"message": "TLE Catalog Synced", "active_objects": count}


@app.post("/api/v1/screen", response_model=List[ConjunctionAlert])
def screen_conjunctions(threshold_km: float = 20.0):
    """
    cKD-Tree ব্যবহার করে O(N log N) সময়ে সব সম্ভাব্য সংঘর্ষ স্ক্যান করে।
    """
    now = datetime.now(timezone.utc)
    positions, ids = pipeline.propagate_all(
        year=now.year, month=now.month, day=now.day,
        hour=now.hour, minute=now.minute, second=float(now.second)
    )

    if len(positions) < 2:
        return []

    # KD-Tree Proximity Query
    tree = cKDTree(positions)
    pairs = tree.query_pairs(r=threshold_km)

    alerts = []
    for i, j in pairs:
        dist = float(np.linalg.norm(positions[i] - positions[j]))
        
        # Relative velocity vector approximation
        v_rel = np.array([7.5, 0.2, 0.1])
        cov1 = default_leo_covariance(is_active_satellite=True)
        cov2 = default_leo_covariance(is_active_satellite=False)

        # 2D B-plane Collision Probability
        miss_vec = positions[i] - positions[j]
        pc = compute_collision_probability_2d(miss_vec, v_rel, cov1, cov2)

        # Maneuver suggestion
        maneuver = calculate_avoidance_maneuver(
            current_miss_km=dist,
            desired_miss_km=25.0,
            time_to_closest_approach_sec=1800.0
        )

        alerts.append(ConjunctionAlert(
            object1_id=ids[i],
            object2_id=ids[j],
            distance_km=round(dist, 3),
            collision_probability_pc=pc,
            recommended_delta_v_mps=maneuver["delta_v_mps"],
            status="CRITICAL" if pc > 1e-4 else "MONITORING"
        ))

    return alerts


@app.post("/api/v1/maneuver/optimize")
def optimize_maneuver(req: ManeuverRequest):
    """
    সর্বনিম্ন ফুয়েল খরচে সংঘর্ষ এড়ানোর জন্য বার্ন ক্যালকুলেট করে।
    """
    result = calculate_avoidance_maneuver(
        current_miss_km=req.current_miss_km,
        desired_miss_km=req.desired_miss_km,
        time_to_closest_approach_sec=req.time_to_closest_approach_sec,
        orbit_semi_major_axis_km=req.orbit_semi_major_axis_km,
        satellite_dry_mass_kg=req.satellite_dry_mass_kg
    )
    return result


@app.get("/api/v1/nasa/fetch-live")
async def fetch_nasa_live_data(category: str = "active", limit: int = 150):
    """
    Fetches real-time TLE orbital data from NASA/CelesTrak and updates the pipeline catalog.
    """
    records = await nasa_service.fetch_live_orbital_tles(category=category, limit=limit)
    if records:
        count = pipeline.load_tle_catalog(records)
        return {
            "status": "SUCCESS",
            "source": "NASA/CelesTrak Ephemeris Feed",
            "category": category,
            "ingested_objects": count
        }
    return {"status": "FALLBACK", "message": "Failed to fetch live stream, retained existing catalog."}


@app.get("/api/v1/nasa/odpo-density")
def get_nasa_odpo_density():
    """
    Returns NASA ODPO ORDEM 3.1 orbital debris spatial density profile & peak hazard bands.
    """
    return nasa_service.get_nasa_odpo_density_model()


@app.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    """
    রিয়েল-টাইম 3D ফ্রন্টএন্ডে ৬০Hz বা নির্দিষ্ট হারে স্যাটেলাইট ও ডেব্রিস পজিশন স্ট্রিম করে।
    """
    await websocket.accept()
    try:
        while True:
            now = datetime.now(timezone.utc)
            pos, ids = pipeline.propagate_all(
                year=now.year, month=now.month, day=now.day,
                hour=now.hour, minute=now.minute, second=float(now.second)
            )

            payload = {
                "timestamp": now.isoformat(),
                "objects": [
                    {"id": id_val, "x": float(pos[idx, 0]), "y": float(pos[idx, 1]), "z": float(pos[idx, 2])}
                    for idx, id_val in enumerate(ids)
                ]
            }
            await websocket.send_json(payload)
            await asyncio.sleep(0.5)  # 2 Hz telemetry update
    except WebSocketDisconnect:
        pass
