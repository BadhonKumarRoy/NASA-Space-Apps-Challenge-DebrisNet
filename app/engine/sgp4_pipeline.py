"""
DebrisNet Orbital Mechanics Engine
SGP4 Vectorized Propagation Pipeline
"""
from typing import List, Tuple, Dict, Any
import numpy as np
from sgp4.api import Satrec, jday


class SGP4Pipeline:
    def __init__(self):
        self.satellites: List[Dict[str, Any]] = []

    def load_tle_catalog(self, tle_records: List[Dict[str, str]]) -> int:
        """
        TLE রেকর্ড লোড ও পার্স করে Satrec অবজেক্ট তৈরি করে।
        tle_records format: [{'id': 'ISS', 'line1': '...', 'line2': '...'}]
        """
        self.satellites = []
        for item in tle_records:
            try:
                sat = Satrec.twoline2rv(item['line1'], item['line2'])
                self.satellites.append({
                    "id": item.get('id', str(sat.satnum)),
                    "name": item.get('name', f"OBJECT-{sat.satnum}"),
                    "satrec": sat
                })
            except Exception as e:
                continue
        return len(self.satellites)

    def propagate_all(self, year: int, month: int, day: int,
                      hour: int, minute: int, second: float) -> Tuple[np.ndarray, List[str]]:
        """
        নির্দিষ্ট Epoch সময়ে সমস্ত অবজেক্টের ৩ডি পজিশন ভেক্টর (ECI ফ্রেম, km) বের করে।
        Returns:
            positions: np.ndarray shape (M, 3)
            active_ids: List of satellite IDs
        """
        jd, fr = jday(year, month, day, hour, minute, second)
        positions = []
        active_ids = []

        for obj in self.satellites:
            sat = obj["satrec"]
            e_code, r, v = sat.sgp4(jd, fr)
            if e_code == 0:
                # r is in km: [x, y, z] in True Equator Mean Equinox (TEME) frame
                positions.append(r)
                active_ids.append(obj["id"])

        if not positions:
            return np.empty((0, 3)), []

        return np.array(positions, dtype=np.float64), active_ids

    def propagate_time_series(self, start_jd: float, start_fr: float,
                              step_seconds: float, num_steps: int) -> np.ndarray:
        """
        টাইম-সিরিজ প্রোফাইল জেনারেট করে (TCA ও ক্লোজ অ্যাপ্রোচ ট্র্যাকিংয়ের জন্য)।
        Returns:
            coords: shape (num_steps, num_sats, 3)
        """
        num_sats = len(self.satellites)
        trajectory_matrix = np.zeros((num_steps, num_sats, 3), dtype=np.float64)

        sec_in_day = 86400.0
        for step in range(num_steps):
            delta_days = (step * step_seconds) / sec_in_day
            total_fr = start_fr + delta_days
            # Correctly split into whole Julian Day + fractional part
            whole_days = int(total_fr)  # floor for positive values
            current_jd = start_jd + whole_days
            current_fr = total_fr - whole_days  # guaranteed [0, 1)

            for idx, obj in enumerate(self.satellites):
                code, r, _ = obj["satrec"].sgp4(current_jd, current_fr)
                if code == 0:
                    trajectory_matrix[step, idx] = r

        return trajectory_matrix
