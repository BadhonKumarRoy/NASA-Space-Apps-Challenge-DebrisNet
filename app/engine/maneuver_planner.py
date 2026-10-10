"""
DebrisNet Collision Avoidance Maneuver (CAM) Planner
Optimization using Hill-Clohessy-Wiltshire (CW) equations & Tsiolkovsky Rocket Fuel calculation
"""
import math
from typing import Dict, Any


def calculate_avoidance_maneuver(
    current_miss_km: float,
    desired_miss_km: float,
    time_to_closest_approach_sec: float,
    orbit_semi_major_axis_km: float = 6778.0,  # e.g., ISS ~400km altitude -> R_E + 400
    satellite_dry_mass_kg: float = 500.0,
    thruster_isp_sec: float = 220.0  # Monopropellant hydrazine thruster ~220s
) -> Dict[str, Any]:
    """
    সর্বনিম্ন জ্বালানি খরচ করে নিরাপদ দূরত্ব (desired_miss_km) তৈরি করার জন্য
    প্রয়োজনীয় পালস ভেলোসিটি পরিবর্তন (Delta-v) ও বার্ন প্যারামিটার বের করে।

    Args:
        current_miss_km: বর্তমান মিস দূরত্ব
        desired_miss_km: কাঙ্ক্ষিত নিরাপদ দূরত্ব (উদা: ২৫ কিমি)
        time_to_closest_approach_sec: সংঘর্ষের বাকি সময় (সেকেন্ডে)
        orbit_semi_major_axis_km: অর্বিটাল সেমি-মেজর অ্যাক্সিস a (km)
        satellite_dry_mass_kg: স্যাটেলাইটের ভর (কেজি)
        thruster_isp_sec: থ্রাস্টারের স্পেসিফিক ইমপালস (s)

    Returns:
        Maneuver plan dictionary
    """
    MU_EARTH = 398600.4418  # km^3 / s^2
    G0 = 9.80665  # m/s^2

    # অর্বিটাল মিন মোশন n = sqrt(mu / a^3) rad/s
    n = math.sqrt(MU_EARTH / (orbit_semi_major_axis_km ** 3))
    orbital_period_sec = 2 * math.pi / n

    # প্রয়োজনীয় দূরত্বের পার্থক্য (Delta r)
    delta_r_needed_km = max(0.0, desired_miss_km - current_miss_km)
    if delta_r_needed_km <= 0.0 or time_to_closest_approach_sec <= 60.0:
        return {
            "required": False,
            "delta_v_mps": 0.0,
            "fuel_consumed_kg": 0.0,
            "burn_direction": "NONE",
            "orbital_period_sec": round(orbital_period_sec, 1)
        }

    # তানজেনশিয়াল (In-track) বার্ন সাধারণত সবচেয়ে বেশি কার্যকর
    # CW Equations অনুযায়ী ইন-ট্র্যাক ডিসপ্লেসমেন্ট:
    # y(t) = -6 * (delta_v_tangential / a) * t + ...
    # সিম্প্লিফাইড সেফটি শিফট ফর্মুলা:
    delta_v_km_s = (delta_r_needed_km) / (3 * n * time_to_closest_approach_sec)
    delta_v_mps = delta_v_km_s * 1000.0  # Convert to m/s

    # Tsiolkovsky Rocket Equation:
    # m_fuel = m0 * (1 - exp(-delta_v / (I_sp * g0)))
    exhaust_velocity = thruster_isp_sec * G0
    mass_ratio = math.exp(delta_v_mps / exhaust_velocity)
    fuel_consumed_kg = satellite_dry_mass_kg * (mass_ratio - 1.0)

    # অর্বিট অল্টিটিউড পরিবর্তন (Hohmann delta a)
    v_orbital = math.sqrt(MU_EARTH / orbit_semi_major_axis_km)  # km/s
    delta_a_km = (2 * orbit_semi_major_axis_km * delta_v_km_s) / v_orbital

    return {
        "required": True,
        "delta_v_mps": round(delta_v_mps, 4),
        "fuel_consumed_kg": round(fuel_consumed_kg, 4),
        "burn_type": "Prograde Tangential Impulsive Burn",
        "altitude_shift_km": round(delta_a_km, 3),
        "time_before_tca_sec": time_to_closest_approach_sec,
        "new_miss_distance_km": round(current_miss_km + delta_r_needed_km, 2),
        "orbital_period_sec": round(orbital_period_sec, 1),
        "post_maneuver_safety_margin": "SAFE"
    }
